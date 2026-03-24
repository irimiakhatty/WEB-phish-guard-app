import { permanentRedirect } from "next/navigation";

export default function DeprecatedAdminUserCreateRouteRedirect() {
  permanentRedirect("/admin?tab=users");
}