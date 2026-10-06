// Test helper: lets node resolve the app's extensionless TypeScript imports ('./pricing' → './pricing.ts').
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) } catch (e) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context)
    throw e
  }
}`))
