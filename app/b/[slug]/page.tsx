import BeautyTemplate from "../../../components/public-site/BeautyTemplate";
import CreativeAtelierTemplate from "../../../components/public-site/CreativeAtelierTemplate";

type PublicBusinessData = {
  business: {
    id: number;
    name: string;
    phone: string | null;
  };

  site: {
    slug: string;
    templateKey: string;
    heroTitle: string | null;
    heroSubtitle: string | null;
    aboutTitle: string | null;
    aboutText: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    address: string | null;
  };

  services: {
    id: number;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: string;
  }[];

  staff: {
    id: number;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  }[];

  gallery: {
    id: number;
    image_url: string;
    sort_order: number;
  }[];
};

async function getBusiness(slug: string): Promise<PublicBusinessData | null> {
  const response = await fetch(
    `http://localhost:3000/api/public/business/${slug}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const data = await getBusiness(slug);

  if (!data) {
    return (
      <main
        style={{
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <h1>Business not found</h1>
      </main>
    );
  }

  switch (data.site.templateKey) {
    case "CREATIVE_ATELIER":
      return <CreativeAtelierTemplate data={data} />;

    case "BEAUTY":
    case "BEAUTY_LUXE":
    default:
      return <BeautyTemplate data={data} />;
  }
}
