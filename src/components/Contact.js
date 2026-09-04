export default function Contact() {
  return (
    <section id="contact" style={{ padding: '80px 5%', backgroundColor: '#f9fafb', borderTop: '1px solid #eaeaea' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: '#2A4365', fontSize: '2.5rem', marginBottom: '20px' }}>
          Ready to Start? Get in Touch
        </h2>
        <p style={{ color: '#4A5568', marginBottom: '30px', fontSize: '1.1rem', lineHeight: '1.6' }}>
          Fill out the form below to discuss your project or request a custom quote. We usually respond within 24 hours.
        </p>
        
        {/* Direct Contact Information */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '30px', 
          marginBottom: '40px', 
          color: '#2A4365', 
          fontWeight: 'bold',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📞</span> +55 42 98406-6238
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✉</span> gestao.excelispro@gmail.com
          </div>
        </div>
        
        <form style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#2A4365', fontWeight: 'bold' }}>Name</label>
            <input 
              type="text" 
              placeholder="Your Name" 
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '1rem' }} 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#2A4365', fontWeight: 'bold' }}>Email</label>
            <input 
              type="email" 
              placeholder="you@company.com" 
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '1rem' }} 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#2A4365', fontWeight: 'bold' }}>Message</label>
            <textarea 
              rows="5" 
              placeholder="Tell us about your takeoff or lean planning needs..." 
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '1rem', fontFamily: 'sans-serif' }}
            ></textarea>
          </div>
          
          <button 
            type="button" 
            style={{ 
              padding: '15px', 
              backgroundColor: '#3182ce', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              fontSize: '1.1rem', 
              fontWeight: 'bold', 
              cursor: 'pointer', 
              marginTop: '10px' 
            }}
          >
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}
