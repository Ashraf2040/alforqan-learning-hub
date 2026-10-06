import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {};
const withNextIntl = createNextIntlPlugin('./i18n.ts');
export default withNextIntl(config);
