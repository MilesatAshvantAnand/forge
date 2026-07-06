// Ad-hoc smoke test for the Bot Gateway rubric engine.
// Run: npx tsx scripts/test-gateway.mts
import { runGateway } from "../src/lib/gateway/rubric";
import type { BotProfile } from "../src/lib/gateway/types";

const profile: BotProfile = {
  id: "t",
  projectId: "p",
  name: "Demo Robot (9999X)",
  firmwareVersion: "1.1.5",
  prosKernelVersion: "4.1.1",
  brainType: "V5",
  components: [
    { port: 1, type: "motor_11w", label: "left drive front", reversed: true, gearset: "blue_600" },
    { port: 2, type: "motor_11w", label: "left drive middle", reversed: true, gearset: "blue_600" },
    { port: 3, type: "motor_11w", label: "left drive back", reversed: true, gearset: "blue_600" },
    { port: 4, type: "motor_11w", label: "right drive front", gearset: "blue_600" },
    { port: 5, type: "motor_11w", label: "right drive middle", gearset: "blue_600" },
    { port: 6, type: "motor_11w", label: "right drive back", gearset: "blue_600" },
    { port: 7, type: "motor_11w", label: "intake", gearset: "green_200" },
    { port: 10, type: "imu", label: "inertial" },
    { port: 11, type: "rotation_sensor", label: "horizontal odom" },
    { port: 12, type: "rotation_sensor", label: "vertical odom" },
    { port: "A", type: "adi_digital_in", label: "intake limit switch" },
  ],
  rubricVersion: "1",
  createdAt: 0,
  updatedAt: 0,
};

const cases: { name: string; code: string; expect: string }[] = [
  {
    name: "valid PROS 4 code matching profile",
    expect: "pass or warn",
    code: `
#include "main.h"
pros::MotorGroup left_motors({-1, -2, -3}, pros::v5::MotorGears::blue);
pros::MotorGroup right_motors({4, 5, 6}, pros::v5::MotorGears::blue);
pros::Motor intake_motor(7, pros::v5::MotorGears::green);
pros::Imu imu(10);
pros::Rotation horizontal_rotation(11);
pros::adi::DigitalIn limit('A');
void opcontrol() {
  intake_motor.move(127); // spin intake
}
`,
  },
  {
    name: "unknown port (motor on 15)",
    expect: "fail (port-unknown)",
    code: `pros::Motor lift(15, pros::v5::MotorGears::red);\nvoid x() { lift.move(50); }`,
  },
  {
    name: "type mismatch (motor on rotation port 11)",
    expect: "fail (port-type-mismatch)",
    code: `pros::Motor roller(11);\nvoid x() { roller.move(50); }`,
  },
  {
    name: "okapi on PROS 4",
    expect: "fail (kernel-api)",
    code: `auto chassis = okapi::ChassisControllerBuilder().withMotors(1, 4).build();`,
  },
  {
    name: "PROS 3 reversed-bool ctor on PROS 4 kernel",
    expect: "fail (kernel-api motor-ctor)",
    code: `pros::Motor intake(7, pros::E_MOTOR_GEARSET_18, true, pros::E_MOTOR_ENCODER_DEGREES);`,
  },
  {
    name: "truncated code (unbalanced braces)",
    expect: "fail (syntax)",
    code: `void autonomous() {\n  left_motors.move(100);\n  // drive forward`,
  },
  {
    name: "no device references",
    expect: "pass with info",
    code: `int clamp(int v) { return v > 127 ? 127 : v; }`,
  },
  {
    name: "reversed mismatch (profile says port 4 not reversed)",
    expect: "warn (motor-reversed-mismatch)",
    code: `pros::MotorGroup right({-4, -5, -6});\nvoid x() { right.move(50); }`,
  },
];

let failures = 0;
for (const c of cases) {
  const report = runGateway(c.code, profile);
  console.log(`\n── ${c.name} (expect: ${c.expect})`);
  console.log(`   verdict=${report.verdict} score=${report.score}`);
  for (const ch of report.checks) {
    console.log(`   [${ch.severity}] ${ch.id}${ch.line ? ` L${ch.line}` : ""}: ${ch.message.slice(0, 110)}`);
  }
  const v = report.verdict;
  const ok =
    (c.expect.startsWith("pass or warn") && (v === "pass" || v === "warn")) ||
    (c.expect.startsWith("fail") && v === "fail") ||
    (c.expect.startsWith("warn") && v === "warn") ||
    (c.expect.startsWith("pass") && v === "pass");
  if (!ok) {
    failures++;
    console.log(`   ✗ UNEXPECTED VERDICT`);
  }
}
console.log(failures === 0 ? "\nAll gateway smoke tests behaved as expected." : `\n${failures} unexpected verdicts.`);
process.exit(failures === 0 ? 0 : 1);
