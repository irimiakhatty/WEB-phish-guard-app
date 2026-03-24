import { permanentRedirect } from "next/navigation";

export default function DeprecatedAdminScansRouteRedirect() {
  permanentRedirect("/admin?tab=scans");
}