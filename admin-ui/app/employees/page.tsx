import { redirect } from 'next/navigation';

/** Kept for backward compatibility: the module now lives at /permissions. */
export default function EmployeesPage() {
  redirect('/permissions');
}
