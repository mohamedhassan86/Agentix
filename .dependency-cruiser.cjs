/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-domain-imports-outside",
      comment: "Domain must not import outside Domain or stdlib",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "^(src/application|src/infrastructure|src/app/|src/worker|node_modules/@prisma|node_modules/next|node_modules/react|@prisma|next|react)",
        pathNot: "^src/domain",
      },
    },
    {
      name: "no-application-imports-infrastructure",
      comment: "Application must not import Infrastructure, App, Worker, React, Next, Prisma",
      severity: "error",
      from: { path: "^src/application" },
      to: {
        path: "^(src/infrastructure|src/app/|src/worker|node_modules/(next|react|@prisma)|@prisma|next/|react)",
      },
    },
    {
      name: "no-application-imports-prisma",
      comment: "Application must not import Prisma client directly",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "(@prisma/client|prisma|src/generated|@prisma/adapter-pg|pg)" },
    },
    {
      name: "no-app-direct-prisma",
      comment: "App layer must not import Prisma directly; use Application ports",
      severity: "error",
      from: { path: "^src/app" },
      to: { path: "(@prisma/client|@prisma/adapter-pg|src/generated)" },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans-domain",
      comment: "Domain should not depend on infrastructure/app/worker",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^(src/infrastructure|src/app/|src/worker)" },
    },
    {
      name: "fixture-domain-imports-infrastructure",
      comment: "Fixture: domain importing infrastructure must fail",
      severity: "error",
      from: { path: "domain-imports-infrastructure" },
      to: { path: "src/infrastructure" },
    },
    {
      name: "fixture-application-imports-prisma",
      comment: "Fixture: application importing prisma must fail",
      severity: "error",
      from: { path: "application-imports-prisma" },
      to: { path: "(@prisma/client|prisma)" },
    },
    {
      name: "fixture-app-imports-prisma",
      comment: "Fixture: app importing prisma must fail",
      severity: "error",
      from: { path: "app-imports-prisma" },
      to: { path: "(@prisma/client|prisma)" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
      archi: {
        collapsePattern: "^(packages|src|lib|app|bin|test(s?)|spec)/[^/]+|node_modules/[^/]+",
      },
    },
  },
};
