# VEX Team 9999X — Engineering Notebook (Demo)

## Drivetrain
- 6 motor tank drive, 450 RPM blue cartridge
- Odometry: 2.75" tracking wheels + IMU via LemLib
- Lateral PID kP=10, kD=3 — tuned on competition tiles

## Intake
- Tested 2:1 speed-up on green (200 RPM) — rings slipped on worn tiles
- Settled on 1:1 green cartridge with flexwheel compression ~3mm
- Anti-jam: reverse motor when current > 2200 mA (see intake.cpp)

## Known issues
- Robot tips when arm extends fully — added counterweight in CAD v3
- Intake jams under heavy ring stacks — investigating roller gap vs stall threshold

## Autonomous
- Red left: 6-ring rush + match load
- Blue right: mirror with different turn radius
- Skills: odometry reset at start tile
