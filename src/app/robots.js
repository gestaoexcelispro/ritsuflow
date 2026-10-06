export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/privacy'], disallow: ['/api/', '/dashboard/', '/commercial/', '/ritsuscope/', '/fieldop/', '/settings/', '/platform-admin/', '/ritsu-admin/', '/workspaces'] }],
    sitemap: 'https://ritsuflow.com/sitemap.xml',
  }
}
