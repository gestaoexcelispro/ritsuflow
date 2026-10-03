import AdminConsole from './AdminConsole'

export default function RitsuAdminPage({ searchParams }) {
  return <AdminConsole initialNodeId={searchParams?.node} />
}
