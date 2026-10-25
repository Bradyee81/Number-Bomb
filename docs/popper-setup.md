# Number Bomb balloon popper

This app bundles firmware for the **classic ESP32 DevKit / CP2102** board.
The firmware is specific to Number Bomb; do not flash it onto the Lucky Draw buzzer.

## Install on the event laptop

1. Install the new Number Bomb Windows installer. An older installed copy will
   not gain this feature just because these source files were edited.
2. **Unplug the heater's 12V adapter** before connecting USB or flashing.
3. Plug the popper ESP32 into the event laptop with a USB data cable.
4. Open **Settings → Balloon popper setup**, check that heater power is
   disconnected, choose its USB port, and click **Update popper firmware**.
   If flashing cannot connect, hold BOOT while it starts connecting, then release.
   Do not unplug during writing. This replaces the firmware on the selected board.
5. Enter the venue's **2.4GHz** WiFi name and password, then **Connect**.
   The laptop and ESP32 must be on the same local network with client-to-client
   access enabled (guest isolation blocks it). There is no internet control.
6. A fresh pairing key and device IP are saved by the app. WiFi credentials are
   stored on the ESP32; the password is not stored by the laptop. Reconnect over
   USB at a different venue or if the device's DHCP address changes.
7. After setup the ESP32 can use an ordinary USB charger; the event laptop
   communicates with it over the local WiFi. No inbound laptop firewall rule is
   added: the laptop initiates connections to the ESP32.

If there is no USB port: check the cable and the Silicon Labs CP210x driver.
The installer does not install a USB driver. Use the same driver as Lucky Draw.

## Trigger wiring (all power unplugged while wiring)

Keep the **working manual push button and timer**:

```
ESP32 3V3 -------- manual NO button -------- timer Trigger
ESP32 GND -------------------------------- timer GND_T
ESP32 GPIO25 ---- 1 kilohm series resistor - timer Trigger
```

The 1kΩ resistor protects the GPIO if the manual button and output overlap.
The output is high impedance with a pulldown when idle, never driven low against
the manual 3.3V button. This must be checked with your particular trigger module:
the resistor's voltage drop may affect its trigger threshold. Test relay-only
before reconnecting heater power. Do not omit the hardware timer or use GPIO25
to supply the heater. COM/NO remain the heater's isolated switching circuit;
they must not be connected to ESP32 3V3 or GPIO25.

Heater path stays as bench-tested:

```
12V adapter + -> input fuse -> physical ARM switch -> CC/CV input +
12V adapter - -------------------------------------> CC/CV input -
CC/CV OUT+ -> timer COM
timer NO  -> heater + at ceramic block
heater -  -> CC/CV OUT-
timer NC empty
```

The hardware ARM switch must disconnect heater power, independently of software.
If it has not been installed and rated yet, unplug the 12V adapter whenever
disarming physically. A software Disarm prevents new network triggers; it cannot
stop a relay pulse already running or a manual-button press. Verify the ARM
switch's DC rating, secure the tip and power wiring, insulate exposed connections
and provide strain relief before event use. Breadboard jumpers are only for
logic, never for heater current.

The successful bench setting was approximately **4V, 1A, two seconds** for the
specific 30AWG Kanthal tip. It is not a universal setting for other tip lengths.
Current-limiter operation was not conclusively verified; do not describe that
protection as proven. Keep the known voltage setting, fuse and timer, and do not
raise settings to compensate for a loose connection.

## Relay-only acceptance test

With the heater adapter still unplugged:

1. Use **Test relay only**: one click on, a second click off after the timer's
   existing two-second interval. Firmware only sends a 100ms trigger.
2. Start a game round, then **Arm this round**. Use Reveal Bomb on the control
   screen to see the test number, and enter that number. One pulse should occur.
3. Undo the hit and enter it again: **no second pulse**. Revealing the bomb,
   rendering the Output window, starting or ending a round must not fire.
4. Start another round. The popper must be disarmed until explicitly armed.
5. Disconnect WiFi or close the app while armed; wait at least five seconds.
   Reconnect: it must require manual arming and must not deliver an old shot.
6. Restart the ESP32 while armed: it must boot with the output inactive and
   require a new arm. The manual button should still work without the router.
7. Confirm once more that the timer cuts off when the manual button is held.

Only after these checks pass, reconnect heater power and repeat the complete
game-to-balloon test with an air-filled balloon, ceramic support, clear working
area, people clear of the tip and eye protection. Observe the current returns
to zero. A device acknowledgement confirms a trigger, not that a balloon popped.

## Build and firmware maintenance

Firmware source: `firmware/popper/src/main.cpp` and pinned PlatformIO config.
Run `npm run popper:firmware` to rebuild/copy the four flash images into
`firmware/popper/bin/`. These are embedded by the desktop executable, so building
the installer does not require PlatformIO on the event laptop. Run the firmware
build before desktop builds whenever firmware changes. Never substitute Lucky
Draw firmware binaries.

`npm run build:windows` builds a local unsigned NSIS installer with firmware
included. This does not publish a GitHub release or alter the installed copy.
Normal signed release builds retain the existing updater workflow.

The device boots disarmed, expires an arm after five seconds without a lease,
rejects old boot IDs and expired one-use challenges, and consumes a round before
triggering. The app does not retry a fire request after any timeout or lost
acknowledgement. These software behaviours complement the hardware timer and
ARM disconnect; physical acceptance testing is still required.
