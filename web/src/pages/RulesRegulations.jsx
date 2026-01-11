import { useState } from "react";
import PageMeta from "../components/common/PageMeta";

// Rules and Regulations Data
const rulesData = {
  intro: {
    title: "WEBTTODA RULES AND REGULATIONS",
    description: "The following infraction and their corresponding penalties are prescribed to maintain the members highest work efficiency, smooth and successful operation of the association and help the WEBTTODA contribute its effectiveness in our community.",
    note: "The officers and trustees believes that the list of infraction and offenses constitutes just cause for disciplinary action and corresponding penalties imposed range from warning and reprimand to suspension and dismissal.",
    additionalNote: "There maybe other offenses major or minor which are not covered by the list, the main point is good performance and the ability to work with others. The success, therefore of our operations both limited and cumulative will depend upon the fullest cooperation of all concerned.",
  },
  sections: [
    {
      id: 1,
      title: "I. WORK AND DRIVE EFFICIENCY",
      icon: "🚗",
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50 dark:bg-blue-900/20",
      rules: [
        {
          number: 1,
          offense: "Any act of insubordination",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 2,
          offense: "Illegal lining other than prescribed point",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 3,
          offense: "Illegal pick-up of passengers",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 4,
          offense: "Wearing sandos, short pants and sandals from Monday to Friday are not authorized, except when declared by the President during rainy days wearing of sandals and shorts pants are authorized",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 5,
          offense: "Wearing sandos during Saturday, Sunday and Holiday are not authorized",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 6,
          offense: "Wearing Slippers and short pants during weekdays",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
      ]
    },
    {
      id: 2,
      title: "II. ACT OF DISHONESTY",
      icon: "⚠️",
      color: "bg-amber-500",
      textColor: "text-amber-600",
      bgLight: "bg-amber-50 dark:bg-amber-900/20",
      rules: [
        {
          number: 7,
          offense: "Failure and or Refusing to pay the daily dues",
          penalties: ["Suspension 1 day", "Suspension 3 days", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 8,
          offense: "FALSE STATEMENT – Any applicant who had been accepted for membership and later found out to have fraudulent entries in order to 'influence' approval",
          penalties: ["Dismissal"]
        },
      ]
    },
    {
      id: 3,
      title: "III. ACT AGAINST PUBLIC POLICY",
      icon: "🚫",
      color: "bg-orange-500",
      textColor: "text-orange-600",
      bgLight: "bg-orange-50 dark:bg-orange-900/20",
      rules: [
        {
          number: 9,
          offense: "Driving under the influence of liquor, drug and or participating in any drinking spree within the WEBTTODA premises or any form of illegal gambling within the route",
          penalties: ["Suspension 1 week", "Dismissal"]
        },
        {
          number: 10,
          offense: "Defacing and or tearing down posters of the association from bulletin board, or adding insulting words and or pictures or marks",
          penalties: ["Suspension 1 week", "Suspension 1 month", "Dismissal"]
        },
        {
          number: 11,
          offense: "Fighting in the association regardless of the cause",
          penalties: ["Suspension 1 week", "Dismissal"]
        },
        {
          number: 12,
          offense: "Attacking another member without any provocation causing bodily harm and/or injury",
          penalties: ["Suspension 1 week", "Dismissal"]
        },
        {
          number: 13,
          offense: "Challenging any member to fight",
          penalties: ["Suspension 2 weeks", "Dismissal"]
        },
        {
          number: 14,
          offense: "Challenging Officers and Trustees",
          penalties: ["Suspension 2 weeks or dismissal", "Dismissal"]
        },
        {
          number: 15,
          offense: "Discourteous Acts Committed against passengers within the association playing route area",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Dismissal"]
        },
        {
          number: 16,
          offense: "Reckless driving within the WEBTTODA playing routes",
          penalties: ["Suspension 1 week or dismissal", "Suspension 1 week"]
        },
        {
          number: 17,
          offense: "Cause ill-will and dissension or create cliques and/or intrigues among the officers, trustees and members",
          penalties: ["Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 18,
          offense: "Treating coercing and intimidating below members",
          penalties: ["Suspension 1 week", "Suspension 1 month", "Dismissal"]
        },
      ]
    },
    {
      id: 4,
      title: "IV. SERIOUS OFFENSES",
      icon: "❌",
      color: "bg-red-500",
      textColor: "text-red-600",
      bgLight: "bg-red-50 dark:bg-red-900/20",
      rules: [
        {
          number: 19,
          offense: "Conviction of any crime where the penalty is for one (1) month or more",
          penalties: ["Dismissal"]
        },
        {
          number: 20,
          offense: "Making malicious false accusation and statement concerning the good name of the association",
          penalties: ["Dismissal"]
        },
        {
          number: 21,
          offense: "Substituting old parts for operators owned property and appropriating same",
          penalties: ["Dismissal"]
        },
        {
          number: 22,
          offense: "Misusing, destroying, defacing and or damaging association property",
          penalties: ["Suspension 1 week or Dismissal"]
        },
        {
          number: 23,
          offense: "Acts of disrespect or discourtesy to the association executive",
          penalties: ["Suspension 1 month", "Dismissal"]
        },
        {
          number: 24,
          offense: "Insulting and or unbecoming conduct and or language to the association officers and trustees",
          penalties: ["Suspension 2 weeks", "Dismissal"]
        },
        {
          number: 25,
          offense: "Disobedience to lawful orders of Marshall",
          penalties: ["Suspension 2 weeks or dismissal", "Dismissal"]
        },
        {
          number: 26,
          offense: "Failure to attend the general meeting during the designated time and place especially drivers without valid reason",
          penalties: ["Suspension 1 day", "Suspension 3 days", "Dismissal"]
        },
        {
          number: 27,
          offense: "Failure to observe personal cleanliness, uncouth clothings",
          penalties: ["Warning", "Suspension 3 days", "Suspension 1 week", "Dismissal"]
        },
      ]
    },
    {
      id: 5,
      title: "V. REPEATED VIOLATIONS",
      icon: "🔄",
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50 dark:bg-purple-900/20",
      rules: [
        {
          number: 28,
          offense: "Three warning within a period of one (1) year last violation",
          penalties: ["Suspension 1 week"]
        },
        {
          number: 29,
          offense: "Three suspension within a period of one (1) year last violation",
          penalties: ["Dismissal"]
        },
        {
          number: 30,
          offense: "If the offense only calls for a lighter penalty such as warning and or/suspension, but the offense itself results in serious and or total injury to any one of the management shall order the immediate dismissal of the erring members.",
          penalties: ["Immediate Dismissal"]
        },
      ]
    },
    {
      id: 6,
      title: "VI. MEMBERSHIP/DISMEMBERSHIP",
      icon: "👥",
      color: "bg-emerald-500",
      textColor: "text-emerald-600",
      bgLight: "bg-emerald-50 dark:bg-emerald-900/20",
      rules: [
        {
          number: 31,
          offense: "Operators with tricycle unit and active drivers are the bona fide members of the WEBTTODA Association.",
          penalties: []
        },
        {
          number: 32,
          offense: "Operators as non drivers after waiving the rights to operate within the WEBTTODA line or sold his/her tricycle unit to anybody will be automatically dismember/termination of benefits with the association.",
          penalties: []
        },
        {
          number: 33,
          offense: "Operators as drivers after waiving the rights to operate or sold their units to others will maintain his membership as driver, provided that he will drive once within a period of three (3) months. Non compliance with the above will automatically be dismembered.",
          penalties: []
        },
        {
          number: 34,
          offense: "Active driver will maintain his membership provided that he will drive once within a period of three (3) months within the WEBTTODA line. Non compliance with the above will automatically be dismembered.",
          penalties: []
        },
        {
          number: 35,
          offense: "Dismembered or terminated driver who re-applies for his membership shall accomplish the requirement as a new applicant and shall pay the membership fee amounting to 50% of the current driver's membership fee.",
          penalties: []
        },
        {
          number: 36,
          offense: "Operators with tricycle units whose intention is to sell his/her unit or waive his/her rights to operate shall have clearance from the President of the Association. Transfer of rights for non-members is ₱10,000 whereas a current member is ₱3,000.",
          penalties: []
        },
        {
          number: 37,
          offense: "Old member facilitating the sale of tricycle unit without the knowledge of the association to evade membership fee of the new owner is subject to board hearing and general member for dismissal.",
          penalties: []
        },
      ]
    },
  ]
};

const RulesRegulations = () => {
  const [expandedSections, setExpandedSections] = useState(new Set([1]));
  const [searchTerm, setSearchTerm] = useState("");

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => {
    setExpandedSections(new Set(rulesData.sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  const getPenaltyStyle = (penalty) => {
    const lower = penalty.toLowerCase();
    if (lower.includes('dismissal')) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
    if (lower.includes('suspension')) {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
    if (lower.includes('warning')) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const filteredSections = rulesData.sections.map(section => ({
    ...section,
    rules: section.rules.filter(rule => 
      searchTerm === "" ||
      rule.offense.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.penalties.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(section => section.rules.length > 0);

  return (
    <>
      <PageMeta
        title="Rules & Regulations | TricycleMOD Admin"
        description="WEBTTODA Rules and Regulations for drivers and operators"
      />

      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
          Rules & Regulations
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Official WEBTTODA rules, regulations, and penalties for members
        </p>
      </div>

      {/* Introduction Card */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <svg className="h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              {rulesData.intro.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
              {rulesData.intro.description}
            </p>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex gap-2">
                <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {rulesData.intro.note}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search rules and regulations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Rules Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors border-l-4 ${section.color.replace('bg-', 'border-')}`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${section.bgLight}`}>
                <span className="text-xl">{section.icon}</span>
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  {section.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {section.rules.length} rule{section.rules.length !== 1 ? 's' : ''}
                </p>
              </div>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Rules List */}
            {expandedSections.has(section.id) && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {section.rules.map((rule, ruleIndex) => (
                  <div
                    key={rule.number}
                    className={`p-4 ${ruleIndex !== section.rules.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
                  >
                    <div className="flex gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${section.color} text-white text-xs font-bold`}>
                        {rule.number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {rule.offense}
                        </p>
                        {rule.penalties.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rule.penalties.map((penalty, pIndex) => (
                              <span
                                key={pIndex}
                                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getPenaltyStyle(penalty)}`}
                              >
                                {pIndex + 1}{getOrdinalSuffix(pIndex + 1)} Offense: {penalty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredSections.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-800 dark:text-white">No rules found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search terms
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Approved for Dissemination
        </p>
        <p className="mt-2 text-lg font-semibold text-gray-800 dark:text-white">
          ERNESTO B. OCCIANO
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          President, WEBTTODA
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          July 21, 2004
        </p>
      </div>
    </>
  );
};

export default RulesRegulations;
