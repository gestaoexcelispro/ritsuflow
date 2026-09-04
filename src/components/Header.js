export default function Header() {
  return (
    <header style={{ 
      position: 'sticky', 
      top: 0, 
      zIndex: 1000, 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '20px 5%', 
      borderBottom: '1px solid #eaeaea',
      backgroundColor: '#ffffff'
    }}>
      {/* Logo Area (now clickable to return to the home page) */}
      <div>
        <a href="/">
          <img 
            src="/logo.jpg" 
            alt="ExcelisPro" 
            style={{ height: '50px', objectFit: 'contain' }} 
          />
        </a>
      </div>

      {/* Menu Principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
        <nav style={{ display: 'flex', gap: '20px', fontWeight: '600', color: '#2A4365' }}>
          <a href="/#services" style={{ textDecoration: 'none', color: 'inherit' }}>Services</a>
          <a href="/#process" style={{ textDecoration: 'none', color: 'inherit' }}>Process</a>
          <a href="/#contact" style={{ textDecoration: 'none', color: 'inherit' }}>Contact</a>
        </nav>
        
        {/* Secondary Actions Area (Login and Language) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '2px solid #eaeaea', paddingLeft: '15px' }}>
          
          {/* New Login Button */}
          <a href="/login" style={{ 
            textDecoration: 'none', 
            color: '#3182ce', 
            fontWeight: 'bold',
            fontSize: '0.95rem'
          }}>
            Login
          </a>

          {/* Language Button */}
          <button style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '24px',
            padding: '5px'
          }} title="Mudar Idioma (EUA/CAN/BRA)">
            ⚙
          </button>
        </div>
      </div>
    </header>
  );
}
