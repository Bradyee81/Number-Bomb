use serde::{Deserialize, Serialize};
use std::{collections::HashSet, io::{Read, Write}, net::{Ipv4Addr, Shutdown, SocketAddr, TcpStream},
    sync::{atomic::{AtomicU64, Ordering}, Mutex}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};
use tauri::Manager;

#[derive(Clone, Serialize, Deserialize)]
struct Pairing { ip: Ipv4Addr, key: String }
#[derive(Default)]
pub struct PopperState {
    session: Mutex<Session>,
    polling: PollCancellation,
}
// Independent of the session lock: an operator command can terminate a blocked
// background read before waiting for that lock. Cancelling a poll isn't a
// disconnect and must not erase the arm needed by the command taking priority.
#[derive(Default)]
struct PollCancellation {
    generation: AtomicU64,
    socket: Mutex<Option<TcpStream>>,
}
impl PollCancellation {
    fn generation(&self) -> u64 { self.generation.load(Ordering::SeqCst) }
    fn cancel(&self) {
        // Increment under the socket lock so registration cannot miss a cancel.
        if let Ok(socket) = self.socket.lock() {
            self.generation.fetch_add(1, Ordering::SeqCst);
            if let Some(stream) = socket.as_ref() { let _ = stream.shutdown(Shutdown::Both); }
        }
    }
    fn register(&self, generation: u64, stream: &TcpStream) -> Result<PollSocket<'_>, String> {
        let mut socket = self.socket.lock().map_err(|_| "Status check busy")?;
        if generation != self.generation() { return Err("Status check superseded".into()); }
        *socket = Some(stream.try_clone().map_err(|e| e.to_string())?);
        Ok(PollSocket(self))
    }
}
struct PollSocket<'a>(&'a PollCancellation);
impl Drop for PollSocket<'_> {
    fn drop(&mut self) { if let Ok(mut socket) = self.0.socket.lock() { *socket = None; } }
}
#[derive(Default)]
struct Session {
    pair: Option<Pairing>, loaded: bool, boot: String, armed: Option<String>, spent: HashSet<String>,
    /// Consecutive failed status checks. One slow WiFi reply is not a disconnect.
    missed_polls: u32,
}
/// Keep in sync with MAX_MISSED_POLLS in src/control/PopperContext.tsx. Three
/// one-second polls stay inside the device's own five-second lease, which
/// disarms it independently if the app really has gone away.
const MAX_MISSED_POLLS: u32 = 3;
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceStatus { firmware: u32, boot: String, challenge: String, armed_round: String }

fn pairing_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("popper-pairing.json"))
}
fn load(app: &tauri::AppHandle, session: &mut Session) {
    if !session.loaded {
        session.loaded = true;
        session.pair = pairing_path(app).ok().and_then(|p| std::fs::read(p).ok())
            .and_then(|b| serde_json::from_slice(&b).ok());
    }
}
fn local_ip(ip: Ipv4Addr) -> bool { ip.is_private() || ip.is_link_local() }

// All device exchanges are serialized under Session's mutex, including status
// polling. Operator commands interrupt a background poll before waiting for
// this lock. No retries, redirects, DNS or stored fire commands.
fn request(pair: &Pairing, body: Option<&str>) -> Result<DeviceStatus, String> {
    request_with_poll(pair, body, None)
}
fn request_with_poll(pair: &Pairing, body: Option<&str>, poll: Option<(&PollCancellation, u64)>) -> Result<DeviceStatus, String> {
    if !local_ip(pair.ip) || pair.key.len() != 32 || !pair.key.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Pair the ESP32 over USB first.".into());
    }
    let address = SocketAddr::from((pair.ip, 80));
    exchange(pair, address, body, poll)
}
fn exchange(pair: &Pairing, address: SocketAddr, body: Option<&str>, poll: Option<(&PollCancellation, u64)>) -> Result<DeviceStatus, String> {
    if let Some((control, generation)) = poll {
        if control.generation() != generation { return Err("Status check superseded".into()); }
    }
    // Connect itself cannot be interrupted using a socket clone. Bound the poll
    // connect phase well below the existing 750ms operator freshness deadline.
    let timeout = if poll.is_some() { 150 } else { 500 };
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_millis(timeout))
        .map_err(|_| "Popper unreachable. Check the same 2.4GHz network; re-arm after reconnecting.".to_string())?;
    let _poll_socket = match poll {
        Some((control, generation)) => Some(control.register(generation, &stream)?),
        None => None,
    };
    stream.set_write_timeout(Some(Duration::from_millis(if poll.is_some() { 50 } else { 500 }))).map_err(|e| e.to_string())?;
    let (method, path) = if body.is_some() { ("POST", "/action") } else { ("GET", "/status") };
    let data = body.unwrap_or("");
    let wire = format!("{method} {path} HTTP/1.0\r\nHost: {}\r\nX-Popper-Key: {}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{data}", pair.ip, pair.key, data.len());
    stream.write_all(wire.as_bytes()).map_err(|_| "Could not send command. No automatic retry.".to_string())?;
    let deadline = Instant::now() + Duration::from_millis(1000);
    let mut response = Vec::new();
    let mut buf = [0u8; 1024];
    loop {
        if let Some((control, generation)) = poll {
            if control.generation() != generation { return Err("Status check superseded".into()); }
        }
        let remaining = deadline.checked_duration_since(Instant::now()).ok_or("Popper reply timed out. No automatic retry.")?;
        // Windows does not always wake a blocked recv when another handle calls
        // shutdown. Short read slices provide a bounded cancellation fallback.
        let read_time = if poll.is_some() { remaining.min(Duration::from_millis(50)) } else { remaining };
        stream.set_read_timeout(Some(read_time)).map_err(|e| e.to_string())?;
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => { response.extend_from_slice(&buf[..n]); if response.len() > 8192 { return Err("Invalid popper reply".into()); } }
            Err(e) if poll.is_some() && matches!(e.kind(), std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock) => continue,
            Err(_) => return Err("Popper reply timed out. Delivery is uncertain; inspect the device before re-arming.".into()),
        }
    }
    let response = String::from_utf8(response).map_err(|_| "Invalid popper reply")?;
    let (headers, response_body) = response.split_once("\r\n\r\n").ok_or("Invalid popper reply")?;
    if !headers.lines().next().unwrap_or("").contains(" 200 ") {
        return Err(format!("Popper refused command: {}", response_body.chars().take(160).collect::<String>()));
    }
    if body.is_some() { return Ok(DeviceStatus { firmware: 1, boot: String::new(), challenge: String::new(), armed_round: String::new() }); }
    let status: DeviceStatus = serde_json::from_str(response_body).map_err(|_| "Unrecognized firmware; update it over USB")?;
    if status.firmware != 1 { return Err("Update popper firmware over USB.".into()); }
    Ok(status)
}

fn action(pair: &Pairing, status: &DeviceStatus, verb: &str, round: &str) -> Result<(), String> {
    action_with_poll(pair, status, verb, round, None)
}
fn action_with_poll(pair: &Pairing, status: &DeviceStatus, verb: &str, round: &str, poll: Option<(&PollCancellation, u64)>) -> Result<(), String> {
    // IDs are generated by the app; never interpolate arbitrary form characters.
    if !round.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') || round.len() > 80 { return Err("Invalid round ID".into()); }
    if !status.boot.bytes().chain(status.challenge.bytes()).all(|c| c.is_ascii_hexdigit()) { return Err("Invalid device session".into()); }
    request_with_poll(pair, Some(&format!("action={verb}&round={round}&boot={}&challenge={}", status.boot, status.challenge)), poll)?;
    Ok(())
}

#[tauri::command(async)]
pub fn popper_status(app: tauri::AppHandle, state: tauri::State<'_, PopperState>, keepalive: Option<String>) -> Result<Option<DeviceStatus>, String> {
    let generation = state.polling.generation();
    let mut s = state.session.lock().map_err(|_| "Device busy")?;
    load(&app, &mut s);
    let pair = s.pair.clone().ok_or("Connect the popper over USB in Settings first.")?;
    let result = (|| {
        let status = request_with_poll(&pair, None, Some((&state.polling, generation)))?;
        if generation != state.polling.generation() { return Err("Status check superseded".into()); }
        if status.boot != s.boot || s.armed.as_deref() != Some(status.armed_round.as_str()) { s.armed = None; }
        s.boot = status.boot.clone();
        if let Some(round) = keepalive.filter(|r| s.armed.as_ref() == Some(r)) {
            action_with_poll(&pair, &status, "lease", &round, Some((&state.polling, generation)))?;
        }
        Ok(status)
    })();
    finish_poll(&mut s, generation, &state.polling, result)
}

fn finish_poll(s: &mut Session, generation: u64, control: &PollCancellation, result: Result<DeviceStatus, String>) -> Result<Option<DeviceStatus>, String> {
    if generation != control.generation() { return Ok(None); }
    match &result {
        Ok(_) => s.missed_polls = 0,
        Err(_) => {
            s.missed_polls += 1;
            if s.missed_polls >= MAX_MISSED_POLLS { s.armed = None; }
        }
    }
    result.map(Some)
}

fn fresh_request(requested_at: u64) -> bool {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    now >= requested_at && now - requested_at <= 750
}

#[tauri::command(async)]
pub fn popper_action(app: tauri::AppHandle, state: tauri::State<'_, PopperState>, verb: String, round: String, requested_at: u64) -> Result<(), String> {
    if !["arm", "disarm", "fire"].contains(&verb.as_str()) { return Err("Invalid action".into()); }
    state.polling.cancel();
    let mut s = state.session.lock().map_err(|_| "Device busy")?;
    load(&app, &mut s);
    if verb != "disarm" && !fresh_request(requested_at) { s.armed = None; return Err("Command expired. Re-arm manually.".into()); }
    let pair = s.pair.clone().ok_or("Popper is not paired")?;
    if verb == "fire" {
        if s.armed.as_ref() != Some(&round) || s.spent.contains(&round) { return Err("Not armed for this round".into()); }
        s.armed = None;
        s.spent.insert(round.clone()); // Consume even if send/ack fails. Never retry.
    } else if verb == "arm" {
        s.armed = None;
        if s.spent.contains(&round) { return Err("This round was already used. Start a new round.".into()); }
    } else { s.armed = None; }
    let result = (|| {
        let status = request(&pair, None)?;
        if verb == "fire" && (status.boot != s.boot || status.armed_round != round) {
            return Err("Popper restarted or disarmed. No shot sent.".into());
        }
        if verb != "disarm" && !fresh_request(requested_at) { return Err("Command expired. No automatic retry.".into()); }
        action(&pair, &status, &verb, &round)?;
        s.missed_polls = 0;
        s.boot = status.boot;
        if verb == "arm" { s.armed = Some(round); }
        Ok(())
    })();
    if result.is_err() { s.armed = None; }
    result
}

#[tauri::command]
pub fn popper_ports() -> Result<Vec<String>, String> {
    Ok(serialport::available_ports().map_err(|e| e.to_string())?.into_iter()
        .filter(|p| matches!(&p.port_type, serialport::SerialPortType::UsbPort(_)))
        .map(|p| p.port_name).collect())
}

#[tauri::command(async)]
pub fn popper_wifi_name() -> Option<String> {
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        let out = std::process::Command::new("netsh").args(["wlan", "show", "interfaces"])
            .creation_flags(0x08000000).output().ok()?;
        return String::from_utf8_lossy(&out.stdout).lines().find_map(|l| {
            let (name, value) = l.split_once(':')?;
            (name.trim() == "SSID").then(|| value.trim().to_string())
        });
    }
    #[cfg(not(windows))] { None }
}

#[tauri::command(async)]
pub fn provision_popper(app: tauri::AppHandle, state: tauri::State<'_, PopperState>, port: String, ssid: String, password: String) -> Result<String, String> {
    // Never persist the WiFi password on the laptop or echo the request.
    if ssid.is_empty() || ssid.len() > 32 || password.len() > 63 { return Err("Check WiFi name/password length.".into()); }
    state.polling.cancel();
    let mut s = state.session.lock().map_err(|_| "Device busy")?;
    s.armed = None;
    let mut serial = serialport::new(&port, 115200).timeout(Duration::from_millis(150))
        .open().map_err(|e| format!("Could not open {port}: {e}"))?;
    let _ = serial.write_data_terminal_ready(false);
    let _ = serial.write_request_to_send(false);
    let mut pending = String::new();
    let mut buffer = [0u8; 256];
    let deadline = Instant::now() + Duration::from_secs(8);
    let mut hello_at = Instant::now() - Duration::from_secs(1);
    let mut identified = false;
    while Instant::now() < deadline {
        if hello_at.elapsed() > Duration::from_millis(500) {
            serial.write_all(b"NB_HELLO\n").map_err(|e| e.to_string())?;
            hello_at = Instant::now();
        }
        if let Ok(n) = serial.read(&mut buffer) {
            pending.push_str(&String::from_utf8_lossy(&buffer[..n]));
            if pending.contains("NB_POPPER:1") { identified = true; break; }
            if pending.len() > 4096 { pending.clear(); }
        }
    }
    if !identified { return Err("No Number Bomb firmware found. Update popper firmware, then Connect again.".into()); }
    let mut random = [0u8; 16];
    getrandom::getrandom(&mut random).map_err(|_| "Could not create pairing key")?;
    let key: String = random.iter().map(|b| format!("{b:02x}")).collect();
    // A fresh USB pairing replaces the previous key; never save WiFi credentials
    // or armed state on the laptop. A lost reply requires Connect again.
    let payload = serde_json::json!({ "command": "provision", "ssid": ssid, "password": password, "key": key });
    serial.write_all(format!("{payload}\n").as_bytes()).map_err(|e| e.to_string())?;
    pending.clear();
    let deadline = Instant::now() + Duration::from_secs(25);
    while Instant::now() < deadline {
        if let Ok(n) = serial.read(&mut buffer) {
            pending.push_str(&String::from_utf8_lossy(&buffer[..n]));
            while let Some(end) = pending.find('\n') {
                let line: String = pending.drain(..=end).collect();
                if let Some(ip) = line.trim().strip_prefix("NB_CONNECTED:") {
                    let ip: Ipv4Addr = ip.parse().map_err(|_| "Invalid device address")?;
                    if !local_ip(ip) { return Err("Device needs a private local WiFi network".into()); }
                    let pair = Pairing { ip, key: key.clone() };
                    std::fs::write(pairing_path(&app)?, serde_json::to_vec(&pair).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
                    s.pair = Some(pair); s.loaded = true; s.boot.clear();
                    return Ok(ip.to_string());
                }
                if line.trim().starts_with("NB_ERROR:") { return Err("Could not join WiFi. Check password and 2.4GHz support.".into()); }
            }
            if pending.len() > 4096 { pending.clear(); }
        }
    }
    Err("WiFi setup timed out. Check the cable and 2.4GHz WiFi, then Connect again.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{net::TcpListener, sync::{mpsc, Arc}, thread};
    #[test] fn refuses_public_and_loopback_addresses() {
        assert!(!local_ip("8.8.8.8".parse().unwrap()));
        assert!(!local_ip("127.0.0.1".parse().unwrap()));
        assert!(local_ip("192.168.1.42".parse().unwrap()));
    }
    #[test] fn rejects_delayed_and_future_fire_requests() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
        assert!(fresh_request(now));
        assert!(!fresh_request(now - 2000));
        assert!(!fresh_request(now + 2000));
    }
    #[test] fn foreground_command_interrupts_a_blocked_status_read() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (started_tx, started_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut byte = [0];
            socket.read_exact(&mut byte).unwrap();
            started_tx.send(()).unwrap();
            // Deliberately don't answer: a fire request must not sit behind
            // the poll's one-second read timeout and expire at 750ms.
            let _ = release_rx.recv();
        });
        let control = Arc::new(PollCancellation::default());
        let worker_control = control.clone();
        let (done_tx, done_rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            let pair = Pairing { ip: "192.168.1.2".parse().unwrap(), key: "a".repeat(32) };
            let generation = worker_control.generation();
            done_tx.send(exchange(&pair, address, None, Some((&worker_control, generation)))).unwrap();
        });
        started_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        control.cancel();
        let result = done_rx.recv_timeout(Duration::from_millis(500));
        let _ = release_tx.send(());
        worker.join().unwrap(); server.join().unwrap();
        assert!(result.unwrap().is_err());
    }
    #[test] fn cancelled_status_is_not_a_disconnect_and_preserves_the_arm() {
        let control = PollCancellation::default();
        let generation = control.generation();
        let mut session = Session { armed: Some("round-a".into()), ..Session::default() };
        control.cancel();
        assert!(finish_poll(&mut session, generation, &control, Err("socket closed by fire".into())).unwrap().is_none());
        assert_eq!(session.armed.as_deref(), Some("round-a"));
        // Genuine network failures disarm once MAX_MISSED_POLLS happen in a row;
        // reconnect never auto-arms.
        for _ in 0..MAX_MISSED_POLLS {
            let generation = control.generation();
            assert!(finish_poll(&mut session, generation, &control, Err("unreachable".into())).is_err());
        }
        assert!(session.armed.is_none());
    }
    #[test] fn a_single_slow_reply_does_not_disarm_but_consecutive_misses_do() {
        let control = PollCancellation::default();
        let ok = || Ok(DeviceStatus { firmware: 1, boot: "b".into(), challenge: "c".into(), armed_round: "round-a".into() });
        let mut session = Session { armed: Some("round-a".into()), ..Session::default() };
        // Misses separated by a successful check never accumulate.
        for _ in 0..5 {
            assert!(finish_poll(&mut session, control.generation(), &control, Err("timed out".into())).is_err());
            assert!(finish_poll(&mut session, control.generation(), &control, ok()).is_ok());
        }
        assert_eq!(session.armed.as_deref(), Some("round-a"));
        for i in 1..=MAX_MISSED_POLLS {
            let _ = finish_poll(&mut session, control.generation(), &control, Err("timed out".into()));
            assert_eq!(session.armed.is_some(), i < MAX_MISSED_POLLS);
        }
    }
    #[test] fn cancellation_before_socket_registration_prevents_the_old_poll() {
        let control = PollCancellation::default();
        let generation = control.generation();
        control.cancel();
        let pair = Pairing { ip: "192.168.1.2".parse().unwrap(), key: "a".repeat(32) };
        let result = exchange(&pair, "127.0.0.1:1".parse().unwrap(), None, Some((&control, generation)));
        assert_eq!(result.err().as_deref(), Some("Status check superseded"));
    }
}
