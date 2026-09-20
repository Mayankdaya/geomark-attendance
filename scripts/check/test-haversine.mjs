/* Haversine unit tests — verified against known great-circle distances. */
import { haversineDistance } from "./distance.mjs";

const cases = [
  { name: "same point",              a: [0, 0],               b: [0, 0],                 expect: 0,        tol: 0.01 },
  /* spherical model: 1 deg = R*pi/180 = 111194.93 m (ellipsoidal WGS-84
     value is 111319.49 m — 0.11% difference, within Haversine tolerance) */
  { name: "1 deg longitude (eq.)",   a: [0, 0],               b: [0, 1],                 expect: 111194.93, tol: 1 },
  { name: "1 deg latitude",          a: [0, 0],               b: [1, 0],                 expect: 111194.93, tol: 1 },
  { name: "London -> Paris",         a: [51.5074, -0.1278],   b: [48.8566, 2.3522],      expect: 343556,   tol: 2000 },
  { name: "30 m north (0.00027 deg)",a: [12.9716, 77.5946],   b: [12.97187, 77.5946],    expect: 30,       tol: 1.5 }
];

let pass = true;
for (const c of cases) {
  const d = haversineDistance(c.a[0], c.a[1], c.b[0], c.b[1]);
  const ok = Math.abs(d - c.expect) <= c.tol;
  pass = pass && ok;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(28)} ${d.toFixed(2)} m (expected ~${c.expect})`);
}
console.log(pass ? "\nALL HAVERSINE TESTS PASSED" : "\nTESTS FAILED");
process.exit(pass ? 0 : 1);
