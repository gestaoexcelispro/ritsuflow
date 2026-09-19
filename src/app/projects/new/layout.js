import Link from 'next/link'

export default function NewProjectLayout({ children }) {
  return (
    <>
      {children}
      <Link
        href="/projects"
        aria-label="Return to Projects"
        style={{
          position: 'fixed',
          top: '15px',
          right: '118px',
          zIndex: 1000,
          height: '38px',
          padding: '0 16px',
          border: '1px solid rgba(255,255,255,.2)',
          borderRadius: '8px',
          color: '#fff',
          background: '#0b4056',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}
      >
        ← Return to Projects
      </Link>
    </>
  )
}
