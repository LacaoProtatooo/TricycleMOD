import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import WebttodaRouteMap from "../components/WebttodaRouteMap";

export default function About() {
  const developers = [
    {
      name: "Donn Anthony Baldoza",
      role: "Lead Developer",
      github: "https://github.com/chrollow",
      image: "/images/user/donpic.png",
    },
    {
      name: "Henrich Lacao",
      role: "Backend Developer",
      github: "https://github.com/LacaoProtatooo",
      image: "/images/user/henrich.jpg",
    },
    {
      name: "Juliana Mae Ines",
      role: "UI/UX Developer",
      github: "https://github.com/julianamae11",
      image: "/images/user/inespic.png",
    },
  ];

  const advisor = {
    name: "Dr. Rico S. Santos",
    role: "Technical Advisor",
    title: "Professor",
    institution: "Technological University of the Philippines",
    image: "/images/user/doc_rico.jpg",
  };

  // WEBTTODA Officers 2025-2027
  const webttodaOfficers = [
    { name: "Richard S. Alegre", position: "President", subtitle: "Chairman of the Board" },
    { name: "Emmanuel I. Bacomo", position: "Vice President", subtitle: "Co-Chairman Grievance Committee" },
    { name: "Arnel V. Tonogan", position: "Treasurer", subtitle: "" },
    { name: "Alberto A. Luchavez", position: "Secretary", subtitle: "" },
    { name: "Pelagia A. Occiano", position: "Auditor", subtitle: "" },
  ];

  const webttodaBoardOfDirectors = [
    { name: "Jayson R. Garcia", position: "Member Grievance Comm." },
    { name: "Eddie M. Jardinel", position: "Co-Chairman Screening Comm." },
    { name: "Arnie F. Senorin", position: "Member Screening Comm." },
    { name: "Alvin A. Mataverde", position: "Member Grievance Comm." },
    { name: "Martin A. Bajande", position: "Member Screening Comm." },
    { name: "Rey V. Salvadora", position: "Business Manager" },
    { name: "Victor S. Sasing", position: "Co-Chairman Environmental Comm." },
    { name: "Marilyn T. Costin", position: "Member Environmental Comm." },
    { name: "Anthony Y. Magabilin", position: "Co-Chairman Peace and Order Comm." },
    { name: "Eduardo C. Darasin", position: "Member Peace and Order Comm." },
    { name: "Rey B. Bolo", position: "Chief Marshall" },
  ];

  const webttodaAdviser = {
    name: "Hon. Ernesto B. Occiano",
    position: "Adviser",
    subtitle: "Former WEBTTODA President",
  };

  const webttodaInfo = {
    address: "Champaca cor. Balatan Sts., Western Bicutan, Taguig City",
    secRegNo: "ANO-91-190714",
    tinNo: "264-035-203-000",
    contactNumbers: ["09651661097", "09998889532"],
  };

  const features = [
    {
      icon: (
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      title: "Regulatory Compliance",
      description:
        "Ensures that tricycle drivers and operators comply with local regulations and association policies.",
      bgColor: "bg-orange-500",
    },
    {
      icon: (
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      title: "Operational Support",
      description:
        "Assists WEBTTODA in managing driver records, announcements, and daily operations.",
      bgColor: "bg-orange-600",
    },
    {
      icon: (
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      title: "Community Safety",
      description:
        "Promotes road safety awareness, accountability, and responsible tricycle services.",
      bgColor: "bg-orange-700",
    },
  ];

  const impacts = [
    {
      icon: (
        <svg
          className="w-6 h-6 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      ),
      text: "Improved transparency and efficiency in operations",
    },
    {
      icon: (
        <svg
          className="w-6 h-6 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      text: "Enhanced regulatory compliance and accountability",
    },
    {
      icon: (
        <svg
          className="w-6 h-6 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      ),
      text: "Supporting long-term community development",
    },
  ];

  return (
    <>
      <PageMeta
        title="About | WEBT-TRaC Admin Dashboard"
        description="About WEBT-TRaC - Western Bicutan Tenement Tricycle Regulatory and Compliance System"
      />
      <PageBreadcrumb pageTitle="About WEBT-TRaC" />

      <div className="space-y-6">
        {/* Hero Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <div className="flex flex-col items-center text-center">
            {/* Logo */}
            <div className="mb-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center shadow-lg">
                  <img
                    src="/src/assets/webttrac_logo_bgrm.png"
                    alt="WEBT-TRaC Logo"
                    className="w-28 h-28 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 lg:text-4xl">
              WEBT-TRaC
            </h1>
            <p className="text-lg text-orange-600 dark:text-orange-400 font-medium mb-4">
              Western Bicutan Tenement – Tricycle Regulatory and Compliance
            </p>

            {/* Intro Text */}
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl text-base leading-relaxed">
              A mobile application designed to enhance tricycle regulation,
              safety, and operational compliance within the Western Bicutan
              Tenement community.
            </p>
          </div>
        </div>

        {/* Mission Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-orange-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              Our Mission
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 italic max-w-xl">
              "Technology empowering safer, organized, and accountable tricycle
              operations."
            </p>
          </div>
        </div>

        {/* What We Do Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            What We Do
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-3xl mx-auto leading-relaxed">
            WEBT-TRaC primarily assists the Western Bicutan Tenement Tricycle
            Operators and Driver's Association (WEBTTODA) by providing digital
            tools that support regulatory compliance, operational monitoring,
            and effective communication among drivers, operators, and
            administrators.
          </p>
        </div>

        {/* Introduction Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            Tricycles in Western Bicutan Tenement
          </h2>
          <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-4 max-w-4xl mx-auto">
            <p>
              The most popular symbol of localized public transport in
              Philippines is the use of tricycles transportation, especially in
              residential areas in urban centres like Western Bicutan Tenement.
              Introducing the necessary last-mile connectivity, these vehicles
              bridge the gap between major transportation facilities and
              residential facilities. However, the industry still faces
              formidable challenges, which include patchy fare systems, informal
              surveillance, and high maintenance costs that endanger the life of
              drivers.
            </p>
            <p>
              Local barangay systems of management are generally manual despite
              widespread use of tricycles. Mobile technology is no longer
              optional but a necessity to address old issues with commuter
              safety and driver responsibility. WEBT-TRaC (Western Bicutan
              Tenement - Tricycle Regulatory and Compliance) is focused on
              turning this important service into a technology-driven transport
              service through modern tools for conduct analysis and operational
              monitoring.
            </p>
          </div>
        </div>

        {/* Background Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            Tricycles as Mode of Transportation
          </h2>
          <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-4 max-w-4xl mx-auto">
            <p>
              Tricycles are the primary means of transportation in the Western
              Bicutan area, which is a dense community. However, the absence of
              a central regulatory platform has been replaced by the presence of
              colorum operations and unbalanced quality of the services. Recent
              research indicates that commuters will never be contented with
              conditions where drivers are not professional and safe.
            </p>
            <p>
              WEBT-TRaC bridges these technological disparities by bringing in a
              localized user-friendly solution that is product and service
              specific to the demands of the Western Bicutan Tenement community.
            </p>
          </div>
        </div>

        {/* WEBTTODA Route Coverage Map Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            WEBTTODA Route Coverage Area
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-3xl mx-auto mb-6 leading-relaxed">
            The map below shows the official WEBTTODA tricycle route in Western
            Bicutan Tenement with a 50-meter service coverage area highlighted.
            This represents the designated operational zone for registered
            tricycle drivers and operators.
          </p>
          <div className="rounded-xl overflow-hidden shadow-lg">
            <WebttodaRouteMap />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-orange-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">
                WEBTTODA Route
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500/20 border border-orange-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">
                50m Coverage Area
              </span>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Key Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50 text-center"
              >
                <div
                  className={`w-16 h-16 ${feature.bgColor} rounded-full flex items-center justify-center mx-auto mb-4 shadow-md`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Our Impact
          </h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {impacts.map((impact, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                {impact.icon}
                <p className="text-gray-700 dark:text-gray-300">{impact.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Statement */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 dark:border-orange-900/50 dark:bg-orange-900/20 lg:p-8">
          <div className="flex flex-col items-center text-center">
            <svg
              className="w-12 h-12 text-orange-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed">
              Built in collaboration with the community, for the community —
              helping ensure safer roads, organized transport services, and a
              more accountable tricycle system in Western Bicutan.
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Meet Our Team
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              The minds behind WEBT-TRaC
            </p>
            <div className="w-16 h-1 bg-orange-500 mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {developers.map((dev, index) => (
              <div
                key={index}
                className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50 text-center"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-orange-200 dark:border-orange-800">
                  <img
                    src={dev.image}
                    alt={dev.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {dev.name}
                </h3>
                <span className="inline-block px-3 py-1 text-sm text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 rounded-full mb-4">
                  {dev.role}
                </span>
                <div>
                  <a
                    href={dev.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-full hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    View GitHub
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Advisor Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Technical Advisor
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Guiding our technical direction
            </p>
            <div className="w-16 h-1 bg-orange-500 mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="max-w-md mx-auto">
            <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-8 dark:border-orange-800 dark:from-orange-900/20 dark:to-orange-800/20 text-center">
              <div className="w-32 h-32 rounded-full mx-auto mb-4 overflow-hidden border-4 border-orange-300 dark:border-orange-700 shadow-lg">
                <img
                  src={advisor.image}
                  alt={advisor.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {advisor.name}
              </h3>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-orange-500 rounded-full mb-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {advisor.role}
              </span>
              <p className="text-orange-700 dark:text-orange-300 text-sm font-medium mb-1">
                {advisor.title}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {advisor.institution}
              </p>
            </div>
          </div>
        </div>

        {/* WEBTTODA Officers Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              WEBTTODA Officers & Board of Directors
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              2025 – 2027
            </p>
            <div className="w-16 h-1 bg-orange-500 mx-auto mt-4 rounded-full"></div>
          </div>

          {/* Officers */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Officers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {webttodaOfficers.map((officer, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {officer.name}
                  </h4>
                  <span className="inline-block px-2 py-0.5 text-xs text-white bg-orange-500 rounded-full mt-2">
                    {officer.position}
                  </span>
                  {officer.subtitle && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      {officer.subtitle}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Board of Directors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Board of Directors
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
              {webttodaBoardOfDirectors.map((member, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50 text-center"
                >
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {member.name}
                  </h4>
                  <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                    {member.position}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Adviser */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Adviser
            </h3>
            <div className="max-w-sm mx-auto">
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20 text-center">
                <div className="w-14 h-14 rounded-full bg-orange-200 dark:bg-orange-800 mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-7 h-7 text-orange-600 dark:text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {webttodaAdviser.name}
                </h4>
                <span className="inline-block px-3 py-1 text-xs text-white bg-orange-500 rounded-full mt-2">
                  {webttodaAdviser.position}
                </span>
                <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                  {webttodaAdviser.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Contact Information
            </h3>
            <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Address</p>
                  <p className="text-gray-600 dark:text-gray-400">{webttodaInfo.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Contact Numbers</p>
                  <p className="text-gray-600 dark:text-gray-400">{webttodaInfo.contactNumbers.join(" / ")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">SEC Registration No.</p>
                  <p className="text-gray-600 dark:text-gray-400">{webttodaInfo.secRegNo}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">TIN No.</p>
                  <p className="text-gray-600 dark:text-gray-400">{webttodaInfo.tinNo}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-800/30 text-center">
          <h3 className="text-xl font-bold text-orange-500 mb-2">WEBT-TRaC</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Western Bicutan Tenement
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
            © {new Date().getFullYear()} All Rights Reserved
          </p>
        </div>
      </div>
    </>
  );
}
