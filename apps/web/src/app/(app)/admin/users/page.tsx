import { permanentRedirect } from "next/navigation";

export default function DeprecatedAdminUsersRouteRedirect() {
  permanentRedirect("/admin?tab=users");
}