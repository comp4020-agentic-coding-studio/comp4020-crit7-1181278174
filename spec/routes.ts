// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it. One of each page type: the home
// page, a plan (the read-only example, seeded at boot), the course list, a
// course, the majors, a major (plain and compared with a plan), the course
// map and one course on it, and the README.
export const ROUTES = [
  "/",
  "/plans/example",
  "/courses/",
  "/courses/COMP2100",
  "/majors/",
  "/majors/SOFT-MAJ",
  "/majors/SOFT-MAJ?plan=example",
  "/map/",
  "/map/COMP2100",
  "/readme/",
];
