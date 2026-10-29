import BookingFlow from "./BookingFlow";

type BeautyTemplateProps = {
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

export default function BeautyTemplate({ data }: BeautyTemplateProps) {
  const { business, site, services, staff, gallery } = data;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f5f1",
        color: "#1c1917",
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* NAVBAR */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(24,20,18,0.92)",
          backdropFilter: "blur(16px)",
          color: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "17px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "30px",
          }}
        >
          <a
            href="#top"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {site.logoUrl && (
              <img
                src={site.logoUrl}
                alt={`${business.name} logo`}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            )}

            <strong
              style={{
                fontSize: "20px",
                fontWeight: 500,
                letterSpacing: "0.5px",
              }}
            >
              {business.name}
            </strong>
          </a>

          <nav
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "center",
              fontFamily: "Arial, sans-serif",
              fontSize: "13px",
            }}
          >
            <a
              href="#services"
              style={{
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Services
            </a>

            <a
              href="#about"
              style={{
                color: "#fff",
                textDecoration: "none",
              }}
            >
              About
            </a>

            {gallery.length > 0 && (
              <a
                href="#gallery"
                style={{
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Gallery
              </a>
            )}

            <a
              href="#team"
              style={{
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Artists
            </a>

            <a
              href="#booking"
              style={{
                color: "#1c1917",
                background: "#f3e6da",
                textDecoration: "none",
                padding: "11px 18px",
                borderRadius: "999px",
                fontWeight: 700,
              }}
            >
              Book Now
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section
        id="top"
        style={{
          minHeight: "92vh",
          position: "relative",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",

          background: site.coverImageUrl
            ? `
              linear-gradient(
                90deg,
                rgba(16,13,12,0.82) 0%,
                rgba(16,13,12,0.58) 45%,
                rgba(16,13,12,0.18) 100%
              ),
              url("${site.coverImageUrl}")
            `
            : `
              radial-gradient(
                circle at 75% 30%,
                #c9a999 0%,
                transparent 32%
              ),
              linear-gradient(
                135deg,
                #2a211d 0%,
                #5f4a40 48%,
                #b99c8d 100%
              )
            `,

          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            width: "100%",
            margin: "0 auto",
            padding: "120px 24px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              maxWidth: "760px",
            }}
          >
            <p
              style={{
                margin: "0 0 24px",
                textTransform: "uppercase",
                letterSpacing: "5px",
                fontFamily: "Arial, sans-serif",
                fontSize: "11px",
                fontWeight: 700,
                opacity: 0.78,
              }}
            >
              Beauty · Care · Experience
            </p>

            <h1
              style={{
                margin: 0,
                maxWidth: "900px",
                fontSize: "clamp(58px, 8vw, 110px)",
                lineHeight: 0.92,
                letterSpacing: "-4px",
                fontWeight: 400,
              }}
            >
              {site.heroTitle ?? `Beauty, elevated by ${business.name}`}
            </h1>

            {site.heroSubtitle && (
              <p
                style={{
                  margin: "30px 0 0",
                  maxWidth: "610px",
                  fontFamily: "Arial, sans-serif",
                  fontSize: "18px",
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                {site.heroSubtitle}
              </p>
            )}

            <div
              style={{
                marginTop: "40px",
                display: "flex",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <a
                href="#booking"
                style={{
                  display: "inline-block",
                  padding: "16px 26px",
                  borderRadius: "999px",
                  background: "#f3e6da",
                  color: "#1c1917",
                  textDecoration: "none",
                  fontFamily: "Arial, sans-serif",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Book an Appointment
              </a>

              <a
                href="#services"
                style={{
                  display: "inline-block",
                  padding: "16px 26px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.45)",
                  color: "#fff",
                  textDecoration: "none",
                  fontFamily: "Arial, sans-serif",
                  fontSize: "14px",
                }}
              >
                Explore Services
              </a>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: "30px",
            bottom: "28px",
            color: "rgba(255,255,255,0.65)",
            fontFamily: "Arial, sans-serif",
            fontSize: "11px",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          Scroll to discover
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="services"
        style={{
          padding: "120px 24px",
          background: "#f8f5f1",
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
              maxWidth: "780px",
              marginBottom: "60px",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#9c7563",
                fontFamily: "Arial, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "3px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Signature experiences
            </p>

            <h2
              style={{
                margin: "16px 0 0",
                fontWeight: 400,
                fontSize: "clamp(44px, 6vw, 76px)",
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              Services designed around you.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
            }}
          >
            {services.map((service, index) => (
              <article
                key={service.id}
                style={{
                  minHeight: "310px",
                  borderRadius: "4px",
                  padding: "32px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  background: index % 2 === 0 ? "#211c19" : "#e9ddd5",
                  color: index % 2 === 0 ? "#fff" : "#1c1917",
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontSize: "11px",
                      letterSpacing: "2px",
                      opacity: 0.6,
                    }}
                  >
                    0{index + 1}
                  </span>

                  <h3
                    style={{
                      margin: "22px 0 12px",
                      fontSize: "30px",
                      fontWeight: 400,
                    }}
                  >
                    {service.name}
                  </h3>

                  {service.description && (
                    <p
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: "14px",
                        lineHeight: 1.7,
                        opacity: 0.75,
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
                      fontFamily: "Arial, sans-serif",
                      fontSize: "13px",
                      opacity: 0.7,
                    }}
                  >
                    {service.duration_minutes} min
                  </span>

                  <strong
                    style={{
                      fontSize: "24px",
                      fontWeight: 400,
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

      {/* ABOUT */}
      <section
        id="about"
        style={{
          padding: "130px 24px",
          background: "#201b18",
          color: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "80px",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: "#d9bda9",
                fontFamily: "Arial, sans-serif",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "4px",
                fontWeight: 700,
              }}
            >
              Our philosophy
            </p>

            <h2
              style={{
                fontSize: "clamp(45px, 6vw, 78px)",
                lineHeight: 1,
                letterSpacing: "-2px",
                fontWeight: 400,
                margin: "18px 0 0",
              }}
            >
              {site.aboutTitle ?? "Beauty should feel personal."}
            </h2>
          </div>

          <div>
            <p
              style={{
                margin: 0,
                fontFamily: "Arial, sans-serif",
                color: "rgba(255,255,255,0.68)",
                fontSize: "18px",
                lineHeight: 1.9,
              }}
            >
              {site.aboutText ??
                `At ${business.name}, every appointment is designed to feel considered, personal and effortless.`}
            </p>

            <a
              href="#booking"
              style={{
                display: "inline-block",
                marginTop: "32px",
                color: "#fff",
                fontFamily: "Arial, sans-serif",
                textDecoration: "none",
                borderBottom: "1px solid rgba(255,255,255,0.6)",
                paddingBottom: "6px",
              }}
            >
              Reserve your experience →
            </a>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section
          id="gallery"
          style={{
            padding: "120px 24px",
            background: "#eee6df",
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
                marginBottom: "46px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "Arial, sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "#9c7563",
                }}
              >
                Inside the studio
              </p>

              <h2
                style={{
                  margin: "14px 0 0",
                  fontSize: "clamp(44px, 5vw, 70px)",
                  fontWeight: 400,
                }}
              >
                Our world
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "12px",
              }}
            >
              {gallery.map((image, index) => (
                <div
                  key={image.id}
                  style={{
                    minHeight: index % 3 === 0 ? "520px" : "360px",
                    overflow: "hidden",
                    background: "#d9ccc4",
                  }}
                >
                  <img
                    src={image.image_url}
                    alt={`${business.name} gallery`}
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: index % 3 === 0 ? "520px" : "360px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TEAM */}
      <section
        id="team"
        style={{
          padding: "120px 24px",
          background: "#faf8f5",
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
              maxWidth: "760px",
              marginBottom: "60px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "Arial, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "3px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#9c7563",
              }}
            >
              Meet the artists
            </p>

            <h2
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(44px, 6vw, 74px)",
                fontWeight: 400,
                lineHeight: 1,
              }}
            >
              The people behind {business.name}.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "22px",
            }}
          >
            {staff.map((member) => (
              <article key={member.id}>
                <div
                  style={{
                    height: "390px",
                    background: "#e8ddd5",
                    overflow: "hidden",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {member.photo_url ? (
                    <img
                      src={member.photo_url}
                      alt={`${member.first_name} ${member.last_name ?? ""}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: "80px",
                        color: "#8d6d5c",
                      }}
                    >
                      {member.first_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: "18px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "25px",
                      fontWeight: 400,
                    }}
                  >
                    {member.first_name} {member.last_name ?? ""}
                  </h3>

                  <p
                    style={{
                      margin: "6px 0 0",
                      fontFamily: "Arial, sans-serif",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "2px",
                      color: "#9c7563",
                    }}
                  >
                    Beauty Professional
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        style={{
          background: "#d7bdae",
          padding: "100px 24px",
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
                fontFamily: "Arial, sans-serif",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Come visit
            </p>

            <h2
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(44px, 6vw, 70px)",
                lineHeight: 1,
                fontWeight: 400,
              }}
            >
              Visit {business.name}
            </h2>
          </div>

          <div
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: "16px",
              lineHeight: 1.9,
            }}
          >
            {site.address && <p>{site.address}</p>}

            {business.phone && <p>{business.phone}</p>}

            <div
              style={{
                display: "flex",
                gap: "20px",
                marginTop: "20px",
              }}
            >
              {site.instagramUrl && (
                <a
                  href={site.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#1c1917",
                  }}
                >
                  Instagram
                </a>
              )}

              {site.facebookUrl && (
                <a
                  href={site.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#1c1917",
                  }}
                >
                  Facebook
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* BOOKING */}
      <section
        id="booking"
        style={{
          padding: "130px 24px",
          background: "#171311",
          color: "#fff",
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
              maxWidth: "760px",
              margin: "0 auto 55px",
            }}
          >
            <p
              style={{
                fontFamily: "Arial, sans-serif",
                fontSize: "11px",
                letterSpacing: "4px",
                textTransform: "uppercase",
                color: "#d7b7a6",
                fontWeight: 700,
              }}
            >
              Reservations
            </p>

            <h2
              style={{
                margin: "16px 0",
                fontSize: "clamp(46px, 7vw, 80px)",
                lineHeight: 0.98,
                fontWeight: 400,
              }}
            >
              Your next appointment starts here.
            </h2>

            <p
              style={{
                margin: "24px auto 0",
                maxWidth: "580px",
                fontFamily: "Arial, sans-serif",
                color: "rgba(255,255,255,0.58)",
                fontSize: "16px",
                lineHeight: 1.7,
              }}
            >
              Choose your service, your preferred professional and the time that
              works for you.
            </p>
          </div>

          <div
            style={{
              background: "#f8f5f1",
              color: "#1c1917",
              padding: "clamp(24px, 5vw, 55px)",
              borderRadius: "28px",
            }}
          >
            <BookingFlow slug={site.slug} services={services} />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: "#100d0c",
          color: "rgba(255,255,255,0.55)",
          padding: "35px 24px",
          fontFamily: "Arial, sans-serif",
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
            fontSize: "12px",
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
