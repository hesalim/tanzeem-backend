import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const [siteRows]: any = await pool.query(
      `
      SELECT
        bs.id AS site_id,
        bs.business_id,
        bs.slug,
        bs.template_key,
        bs.hero_title,
        bs.hero_subtitle,
        bs.about_title,
        bs.about_text,
        bs.logo_url,
        bs.cover_image_url,
        bs.instagram_url,
        bs.facebook_url,
        bs.address,

        b.name AS business_name,
        b.phone AS business_phone

      FROM business_sites bs

      INNER JOIN businesses b
        ON b.id = bs.business_id

      WHERE bs.slug = ?
        AND bs.is_published = TRUE

      LIMIT 1
      `,
      [slug],
    );

    if (siteRows.length === 0) {
      return NextResponse.json(
        { message: "Business website not found" },
        { status: 404 },
      );
    }

    const site = siteRows[0];

    const [serviceRows]: any = await pool.query(
      `
      SELECT
        id,
        name,
        description,
        duration_minutes,
        price
      FROM services
      WHERE business_id = ?
        AND is_active = TRUE
      ORDER BY name
      `,
      [site.business_id],
    );

    const { searchParams } = new URL(request.url);

    const serviceId = Number(searchParams.get("serviceId"));

    let staffRows: any;

    if (serviceId) {
      const [rows]: any = await pool.query(
        `
   SELECT
  st.id,
  st.first_name,
  st.last_name,
  st.photo_url
    FROM staff st

    INNER JOIN staff_services ss
      ON ss.staff_id = st.id

    INNER JOIN services s
      ON s.id = ss.service_id

    WHERE st.business_id = ?
      AND st.is_active = TRUE
      AND s.id = ?
      AND s.business_id = ?
      AND s.is_active = TRUE

    ORDER BY st.first_name, st.last_name
    `,
        [site.business_id, serviceId, site.business_id],
      );

      staffRows = rows;
    } else {
      const [rows]: any = await pool.query(
        `
  SELECT
  id,
  first_name,
  last_name,
  photo_url
    FROM staff
    WHERE business_id = ?
      AND is_active = TRUE
    ORDER BY first_name, last_name
    `,
        [site.business_id],
      );

      staffRows = rows;
    }

    const [galleryRows]: any = await pool.query(
      `
  SELECT
    id,
    image_url,
    sort_order
  FROM business_site_gallery
  WHERE business_site_id = ?
  ORDER BY sort_order, id
  `,
      [site.site_id],
    );

    return NextResponse.json({
      business: {
        id: site.business_id,
        name: site.business_name,
        phone: site.business_phone,
      },

      site: {
        slug: site.slug,
        templateKey: site.template_key,

        heroTitle: site.hero_title,
        heroSubtitle: site.hero_subtitle,

        aboutTitle: site.about_title,
        aboutText: site.about_text,

        logoUrl: site.logo_url,
        coverImageUrl: site.cover_image_url,

        instagramUrl: site.instagram_url,
        facebookUrl: site.facebook_url,

        address: site.address,
      },

      services: serviceRows,

      staff: staffRows,

      gallery: galleryRows,
    });
  } catch (error) {
    console.error("PUBLIC BUSINESS GET ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to load business website",
      },
      {
        status: 500,
      },
    );
  }
}
