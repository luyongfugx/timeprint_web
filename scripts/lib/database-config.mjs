export function databaseConfigured() {
  return Boolean(
    process.env.DATABASE_URL ||
      (process.env.TEMPLATE_MYSQL_HOST && process.env.TEMPLATE_MYSQL_DATABASE && process.env.TEMPLATE_MYSQL_USER),
  );
}

// One configuration source for the web app, maintenance scripts and Prisma CLI.
// Never print the resolved URL: it contains database credentials.
export function databaseURL() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://");
    return url.toString();
  }
  if (!databaseConfigured()) throw new Error("Configure DATABASE_URL or TEMPLATE_MYSQL_* first.");
  const host = process.env.TEMPLATE_MYSQL_HOST;
  const authority = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const url = new URL(`mysql://${authority}:${process.env.TEMPLATE_MYSQL_PORT || "3306"}`);
  url.username = process.env.TEMPLATE_MYSQL_USER;
  url.password = process.env.TEMPLATE_MYSQL_PASSWORD || "";
  url.pathname = `/${encodeURIComponent(process.env.TEMPLATE_MYSQL_DATABASE)}`;
  url.searchParams.set("connection_limit", "10");
  url.searchParams.set("pool_timeout", "30");
  if (process.env.TEMPLATE_MYSQL_SSL === "true") {
    url.searchParams.set("sslaccept", "strict");
    // Prisma's native MySQL connector enables TLS with sslaccept configured.
  }
  return url.toString();
}
