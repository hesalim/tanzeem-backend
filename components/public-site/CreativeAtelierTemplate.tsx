import BookingFlow from "./BookingFlow";

type CreativeAtelierTemplateProps = {
  data: {
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
};

export default function CreativeAtelierTemplate({
  data,
}: CreativeAtelierTemplateProps) {
  const { business, site, services, gallery } = data;

  const sage = "#70856f";
  const dark = "#18201b";
  const cream = "#f3e7b7";
  const paper = "#eee8db";
  const terracotta = "#c58b63";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: paper,
        color: dark,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* NAVBAR */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: dark,
          color: cream,
          borderBottom: "1px solid rgba(243,231,183,0.15)",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <a
            href="#top"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
              color: cream,
            }}
          >
            {site.logoUrl && (
              <img
                src={site.logoUrl}
                alt={`${business.name} logo`}
                style={{
                  width: "48px",
                  height: "48px",
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
              />
            )}

            <strong
              style={{
                fontSize: "20px",
                letterSpacing: "-0.3px",
              }}
            >
              {business.name}
            </strong>
          </a>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              fontSize: "13px",
            }}
          >
            <a
              href="#workshops"
              style={{
                color: cream,
                textDecoration: "none",
              }}
            >
              Workshops
            </a>

            <a
              href="#story"
              style={{
                color: cream,
                textDecoration: "none",
              }}
            >
              Our Space
            </a>

            {gallery.length > 0 && (
              <a
                href="#gallery"
                style={{
                  color: cream,
                  textDecoration: "none",
                }}
              >
                Gallery
              </a>
            )}

            <a
              href="#booking"
              style={{
                textDecoration: "none",
                background: cream,
                color: dark,
                padding: "11px 18px",
                borderRadius: "999px",
                fontWeight: 700,
              }}
            >
              Book a Workshop
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section
        id="top"
        style={{
          minHeight: "90vh",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          background: site.coverImageUrl
            ? `
              linear-gradient(
                rgba(24,32,27,0.34),
                rgba(24,32,27,0.55)
              ),
              url("${site.coverImageUrl}")
            `
            : sage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: cream,
        }}
      >
        {/* decorative blob */}
        {!site.coverImageUrl && (
          <>
            <div
              style={{
                position: "absolute",
                width: "520px",
                height: "520px",
                borderRadius: "44% 56% 62% 38%",
                background: "#879b83",
                right: "-100px",
                top: "90px",
              }}
            />

            <div
              style={{
                position: "absolute",
                width: "280px",
                height: "280px",
                borderRadius: "60% 40% 45% 55%",
                background: terracotta,
                right: "180px",
                bottom: "-90px",
                opacity: 0.75,
              }}
            />
          </>
        )}

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "100px 24px",
          }}
        >
          <div
            style={{
              maxWidth: "800px",
            }}
          >
            <p
              style={{
                margin: "0 0 24px",
                textTransform: "uppercase",
                letterSpacing: "4px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Make · Explore · Create
            </p>

            <h1
              style={{
                margin: 0,
                maxWidth: "860px",
                fontSize: "clamp(64px, 9vw, 126px)",
                lineHeight: 0.87,
                letterSpacing: "-7px",
                fontWeight: 800,
              }}
            >
              {site.heroTitle ?? "Come make something with us."}
            </h1>

            <p
              style={{
                marginTop: "32px",
                maxWidth: "600px",
                fontSize: "18px",
                lineHeight: 1.7,
                color: "rgba(243,231,183,0.88)",
              }}
            >
              {site.heroSubtitle ??
                "Hands-on creative workshops, shared experiences and a space made for curiosity."}
            </p>

            <div
              style={{
                marginTop: "38px",
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <a
                href="#workshops"
                style={{
                  background: cream,
                  color: dark,
                  textDecoration: "none",
                  padding: "15px 24px",
                  borderRadius: "999px",
                  fontWeight: 700,
                }}
              >
                Explore Workshops
              </a>

              <a
                href="#booking"
                style={{
                  color: cream,
                  textDecoration: "none",
                  padding: "15px 24px",
                  borderRadius: "999px",
                  border: `1px solid ${cream}`,
                }}
              >
                Reserve Your Spot
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* WORKSHOPS */}
      <section
        id="workshops"
        style={{
          padding: "120px 24px",
          background: cream,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "40px",
              alignItems: "end",
              marginBottom: "55px",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "3px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: sage,
                }}
              >
                What&apos;s happening
              </p>

              <h2
                style={{
                  margin: "14px 0 0",
                  fontSize: "clamp(48px, 7vw, 82px)",
                  lineHeight: 0.98,
                  letterSpacing: "-4px",
                }}
              >
                Pick something.
                <br />
                Get your hands dirty.
              </h2>
            </div>

            <p
              style={{
                margin: 0,
                maxWidth: "480px",
                lineHeight: 1.8,
                fontSize: "16px",
              }}
            >
              Discover workshops designed for making, learning and spending time
              differently.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {services.map((service, index) => (
              <article
                key={service.id}
                style={{
                  minHeight: "360px",
                  borderRadius: "28px",
                  padding: "30px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  background:
                    index % 3 === 0
                      ? sage
                      : index % 3 === 1
                        ? paper
                        : terracotta,
                  color: index % 3 === 0 ? cream : dark,
                }}
              >
                <div>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      border: "1px solid currentColor",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      opacity: 0.7,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <h3
                    style={{
                      margin: "30px 0 12px",
                      fontSize: "34px",
                      lineHeight: 1,
                      letterSpacing: "-1.5px",
                    }}
                  >
                    {service.name}
                  </h3>

                  {service.description && (
                    <p
                      style={{
                        lineHeight: 1.7,
                        opacity: 0.8,
                      }}
                    >
                      {service.description}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "end",
                    gap: "20px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                    }}
                  >
                    {service.duration_minutes} min
                  </span>

                  <strong
                    style={{
                      fontSize: "25px",
                    }}
                  >
                    ${Number(service.price).toFixed(2)}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* STORY */}
      <section
        id="story"
        style={{
          padding: "130px 24px",
          background: dark,
          color: cream,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "90px",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#9aaf94",
                fontSize: "11px",
                letterSpacing: "4px",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Our space
            </p>

            <h2
              style={{
                margin: "18px 0 0",
                fontSize: "clamp(48px, 7vw, 86px)",
                lineHeight: 0.95,
                letterSpacing: "-4px",
              }}
            >
              {site.aboutTitle ?? "Made for people who want to make."}
            </h2>
          </div>

          <div>
            <p
              style={{
                margin: 0,
                fontSize: "18px",
                lineHeight: 1.9,
                color: "rgba(243,231,183,0.72)",
              }}
            >
              {site.aboutText ??
                `${business.name} is a creative space for workshops, experiments, good ideas and even better company.`}
            </p>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section
          id="gallery"
          style={{
            padding: "120px 24px",
            background: paper,
          }}
        >
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
            }}
          >
            <p
              style={{
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "3px",
                fontSize: "11px",
                fontWeight: 700,
                color: sage,
              }}
            >
              Made here
            </p>

            <h2
              style={{
                margin: "14px 0 50px",
                fontSize: "clamp(48px, 7vw, 82px)",
                letterSpacing: "-4px",
              }}
            >
              A little creative chaos.
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
              }}
            >
              {gallery.map((image, index) => (
                <div
                  key={image.id}
                  style={{
                    height: index % 4 === 0 ? "520px" : "360px",
                    overflow: "hidden",
                    borderRadius: "22px",
                  }}
                >
                  <img
                    src={image.image_url}
                    alt={`${business.name} workshop`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRIVATE EVENTS */}
      <section
        style={{
          padding: "110px 24px",
          background: sage,
          color: cream,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "70px",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "3px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Make it yours
            </p>

            <h2
              style={{
                margin: "15px 0 0",
                fontSize: "clamp(48px, 7vw, 80px)",
                lineHeight: 0.95,
                letterSpacing: "-4px",
              }}
            >
              Birthdays.
              <br />
              Groups.
              <br />
              Private sessions.
            </h2>
          </div>

          <div>
            <p
              style={{
                fontSize: "18px",
                lineHeight: 1.8,
              }}
            >
              Looking for a creative group experience? Private workshops can
              turn a celebration, team outing or gathering into something people
              actually remember.
            </p>

            <a
              href="#contact"
              style={{
                display: "inline-block",
                marginTop: "20px",
                color: cream,
                textDecoration: "none",
                borderBottom: `1px solid ${cream}`,
                paddingBottom: "6px",
              }}
            >
              Get in touch →
            </a>
          </div>
        </div>
      </section>

      {/* BOOKING */}
      <section
        id="booking"
        style={{
          padding: "130px 24px",
          background: cream,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              textAlign: "center",
              maxWidth: "800px",
              margin: "0 auto 55px",
            }}
          >
            <p
              style={{
                margin: 0,
                color: sage,
                fontSize: "11px",
                letterSpacing: "4px",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Join a workshop
            </p>

            <h2
              style={{
                margin: "16px 0",
                fontSize: "clamp(52px, 8vw, 92px)",
                lineHeight: 0.92,
                letterSpacing: "-5px",
              }}
            >
              Your seat is waiting.
            </h2>

            <p
              style={{
                maxWidth: "560px",
                margin: "24px auto 0",
                lineHeight: 1.8,
              }}
            >
              Pick a workshop and find a session that works for you.
            </p>
          </div>

          <div
            style={{
              background: paper,
              borderRadius: "30px",
              padding: "clamp(24px, 5vw, 55px)",
            }}
          >
            <BookingFlow slug={site.slug} services={services} />
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        style={{
          padding: "100px 24px",
          background: dark,
          color: cream,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "60px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "3px",
                fontSize: "11px",
              }}
            >
              Find us
            </p>

            <h2
              style={{
                margin: "15px 0 0",
                fontSize: "clamp(48px, 7vw, 78px)",
                lineHeight: 0.95,
              }}
            >
              Come create with us.
            </h2>
          </div>

          <div
            style={{
              lineHeight: 1.9,
            }}
          >
            {site.address && <p>{site.address}</p>}

            {business.phone && <p>{business.phone}</p>}

            {site.instagramUrl && (
              <a
                href={site.instagramUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  color: cream,
                  marginTop: "12px",
                }}
              >
                Instagram ↗
              </a>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: "#0e1310",
          color: "rgba(243,231,183,0.55)",
          padding: "32px 24px",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <span>
            © {new Date().getFullYear()} {business.name}
          </span>

          <span>Powered by Tanzeem</span>
        </div>
      </footer>
    </main>
  );
}
