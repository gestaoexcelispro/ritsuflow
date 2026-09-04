export default function Services() {
  return (
    <section id="services" style={{ 
      padding: '80px 5%', 
      backgroundColor: '#f9fafb',
      borderTop: '1px solid #eaeaea',
      borderBottom: '1px solid #eaeaea'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        color: '#2A4365', 
        fontSize: '2.5rem', 
        marginBottom: '50px' 
      }}>
        How We Maximize Your Project Efficiency
      </h2>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '40px', 
        flexWrap: 'wrap', 
        maxWidth: '1200px', 
        margin: '0 auto' 
      }}>
        {/* Card 1: Construction Takeoff */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '40px', 
          borderRadius: '12px', 
          width: '45%', 
          minWidth: '300px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)' 
        }}>
          <h3 style={{ color: '#2A4365', fontSize: '1.8rem', marginBottom: '15px' }}>
            Construction Takeoff
          </h3>
          <p style={{ color: '#4A5568', lineHeight: '1.7', fontSize: '1.1rem' }}>
            We transform detailed blueprints into accurate material quantites directly within Excel. From plumbing to framing, our precise takeoffs help you build more competitive bids and eliminate costly material shortages.
          </p>
        </div>

        {/* Card 2: Lean Planning */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '40px', 
          borderRadius: '12px', 
          width: '45%', 
          minWidth: '300px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)' 
        }}>
          <h3 style={{ color: '#2A4365', fontSize: '1.8rem', marginBottom: '15px' }}>
            Construction Lean Planning
          </h3>
          <p style={{ color: '#4A5568', lineHeight: '1.7', fontSize: '1.1rem' }}>
            Automate and optimize your project schedules. Our Excel-based tools apply Lean principles like the Last Planner System, visual dashboards, and automated look-ahead plans to reduce waste, improve reliable flow, and keep projects on track.
          </p>
        </div>
      </div>
    </section>
  );
}
