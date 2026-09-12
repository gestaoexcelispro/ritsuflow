export const metadata = {
  title: 'Daily Report | RitsuFlow',
  description:
    'Standalone RitsuFlow Daily Report field management workspace.',
};

export default function DailyReportLayout({ children }) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        minWidth: 0,
        margin: 0,
        background: '#f4f6f8',
      }}
    >
      {children}
    </div>
  );
}
