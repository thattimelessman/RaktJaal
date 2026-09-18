import { redirect } from "next/navigation";

// The old plain /signup form is superseded by the new /register design.
// Kept as a redirect so any existing links/bookmarks still work.
export default function SignupRedirect() {
  redirect("/register");
}
