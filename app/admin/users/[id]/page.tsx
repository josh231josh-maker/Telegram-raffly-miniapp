import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import UserDetail from "@/components/admin/user-detail";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  return <UserDetail id={id} />;
}
