export const metadata = {
  title: 'Takeoff | RitsuFlow',
  description:
    'RitsuFlow CAD-style construction drawing takeoff workspace.',
}


export default function TakeoffLayout({
  children,
}) {

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        minWidth: 0,
        minHeight: 0,
        margin: 0,
        overflow: 'hidden',
        background: '#dfe6ec',
      }}
    >
      {children}
    </div>
  )

}
