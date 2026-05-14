import "server-only";

const DEFAULT_APP_URL = "http://localhost:3000";

export function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_APP_URL
  );
}

export function getAppOrigin() {
  return new URL(getAppUrl()).origin;
}
