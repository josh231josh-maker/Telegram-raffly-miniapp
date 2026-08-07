import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import AdminDashboard from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  return <AdminDashboard />;
}
