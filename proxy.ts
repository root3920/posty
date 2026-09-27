import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isPublicRoute } from '@/lib/auth/public-routes';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // -------------------------------------------------------
  // Geo: persist country from Vercel's IP header into a cookie
  // -------------------------------------------------------
  const ipCountry = request.headers.get('x-vercel-ip-country');
  const existingCountryCookie = request.cookies.get('posty_country')?.value;

  const geoResponse = NextResponse.next({ request });

  if (ipCountry && ipCountry !== existingCountryCookie) {
    geoResponse.cookies.set('posty_country', ipCountry, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  // Allow public routes without auth check
  if (isPublicRoute(pathname)) {
    return geoResponse;
  }

  // Allow static assets, icons, and metadata files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/brand/') ||
    pathname === '/icon.svg' ||
    pathname === '/apple-icon.png' ||
    pathname === '/manifest.webmanifest' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Skip auth check if Supabase is not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on login page → redirect to dashboard
  if (pathname === '/login' || pathname === '/registro') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Carry the geo cookie into the supabase response if it was set
  if (ipCountry && ipCountry !== existingCountryCookie) {
    supabaseResponse.cookies.set('posty_country', ipCountry, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  // Permission-based routing will be added in Phase 2
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|brand/|sitemap.xml|robots.txt).*)',
  ],
};
