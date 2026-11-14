"""Write data/stage.json: the figures the path uses beyond the cost tables.
Wages, poverty line and subsidy rule, household spending by family size, the runway rule, FSA terms,
courses and resources by state, job boards. Every entry carries its source with a date and link.
Run: python scripts/make_stage.py  then  python scripts/bundle_data.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SOURCES = {
    "fsa": {"name": "USDA Farm Service Agency, Farm Loan Information Chart (October 2025) and Current FSA Loan Interest Rates (November 1, 2026)", "date": "November 2026",
            "url": "https://www.fsa.usda.gov/sites/default/files/2025-11/FSA_farm_loan_info_chart%20%282%29.pdf"},
    "runway": {"name": "Estimate: months of expenses to keep in hand", "date": "", "url": "", "estimate": True,
               "basis": "Extension family-finance guides commonly advise three to six months of expenses in reserve; three is the floor used here."},
    "wages": {"name": "BLS Occupational Employment and Wage Statistics, May 2025, occupation 45-2093 Farmworkers, Farm, Ranch, and Aquacultural Animals (and 47-4031 Fence Erectors, 45-2091 Agricultural Equipment Operators, 53-3032 Heavy and Tractor-Trailer Truck Drivers)", "date": "2026", "url": "https://data.bls.gov/oes/#/area/0000000/2025"},
    "household": {"name": "BLS Consumer Expenditure Surveys, Table 1400, Size of consumer unit, 2025 (average annual expenditures less housing and healthcare, which the path counts on their own lines)", "date": "October 29, 2026", "url": "https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-size-2025.xlsx"},
    "aca": {"name": "HHS 2026 Poverty Guidelines; IRS Rev. Proc. 2025-25 applicable percentage table for 2026; KFF average marketplace benchmark premiums 2026; KFF subsidy calculator", "date": "January 2026 and November 2026", "url": "https://www.kff.org/interactive/subsidy-calculator/"},
    "food": {"name": "USDA Food and Nutrition Service, Official USDA Thrifty Food Plan, U.S. average, October 2026", "date": "October 2026", "url": "https://www.fns.usda.gov/sites/default/files/resource-files/CostofFoodOct2026Thrifty.pdf"},
    "budget": {"name": "Utah State University Extension, PowerPay debt reduction tool", "date": "2025", "url": "https://extension.usu.edu/powerpay"},
    "jobs": {"name": "Ranch and farm job boards, read November 14, 2026", "date": "November 2026", "url": "https://ranchwork.com/"},
    "medicaid": {"name": "KFF, Status of State Action on the Medicaid Expansion Decision (November 2026); healthcare.gov, Medicaid expansion and what it means for you", "date": "November 2026", "url": "https://www.kff.org/affordable-care-act/state-indicator/state-activity-around-expanding-medicaid-under-the-affordable-care-act/"},
    "courses": {"name": "Beginning farmer and rancher programs, courses and land-link listings by state, read from each program's own page", "date": "November 14, 2026",
                "url": "https://farmanswers.org/"},
}

# Courses and help, national then by state. Each: name, who, url, what, cost (as printed or ''), date (as printed or '').
def c(name, who, url, what, cost="", date=""):
    return {"name": name, "who": who, "url": url, "what": what, "cost": cost, "date": date}

COURSES = {
    "national": [
        c("Beef Quality Assurance online certification", "Beef Checkoff and NCBA", "https://www.bqa.org/beef-quality-assurance-certification", "Two to three hours online, a certificate every buyer and lease owner recognizes.", "free online", "2026"),
        c("farmers.gov, Beginning farmers", "USDA", "https://www.farmers.gov/your-business/beginning-farmers", "The six steps, the loan tool, and the beginning farmer coordinator for your state.", "free", "December 2025"),
        c("State beginning farmer and rancher coordinators", "USDA", "https://www.farmers.gov/your-business/beginning-farmers/coordinators", "A name, email and phone number in every state. Call them.", "free", ""),
        c("Find your USDA service center", "USDA", "https://www.farmers.gov/working-with-us/service-center-locator", "The FSA and NRCS offices for your county.", "free", ""),
        c("Farm Answers", "University of Minnesota and USDA NIFA", "https://farmanswers.org/", "A searchable library of beginning farmer training, budgets and a program finder.", "free", "November 2026"),
        c("Farm Link Finder", "American Farmland Trust", "https://farmlandinfo.org/farm-link-finder/", "Every land-link program in the country: landowners looking for a new operator.", "free", "2026"),
        c("Write your business plan", "U.S. Small Business Administration", "https://www.sba.gov/business-guide/plan-your-business/write-your-business-plan", "Free templates, a startup cost worksheet, and free counseling.", "free", ""),
        c("Grazing Essentials", "Noble Research Institute, Ardmore, Oklahoma", "https://www.noble.org/grazing-essentials/", "Three days on grazing management, with a follow-up consultation.", "$595", "2026"),
        c("Ranching for Profit School", "Ranch Management Consultants", "https://ranchingforprofit.com/ranching-for-profit-school/", "Six days on running a ranch as a business. The one the good operators talk about.", "deposit $500; tuition on request", "2026"),
    ],
    "states": {
        "TX": [
            c("Beginning Beef Cattle Operations, online", "Texas A&M AgriLife Extension", "https://agrilifeextension.tamu.edu/asset-external/beginning-beef-cattle-operations-battleground-to-breaking-ground/", "Self-paced introduction to running a beef operation.", "free", "February 2026"),
            c("Ranch Management University", "Texas A&M AgriLife Extension", "https://forages.tamu.edu/rmu/", "Four and a half days in College Station for new landowners, April and October.", "$525; $325 for veterans and first responders", "2026"),
            c("Generation Next: Our Turn to Ranch", "Texas A&M AgriLife Extension", "https://generationnext.tamu.edu/", "Twelve-week online business plan course for new landowners.", "$300", "January 2027"),
            c("Beef Cattle Short Course", "Texas A&M AgriLife", "https://agrilifetoday.tamu.edu/2026/05/14/registration-open-for-texas-am-beef-cattle-short-course-aug-3-5/", "Three days every August in College Station.", "$300 in person, $99 online", "August 2026"),
            c("Texas and Southwestern Cattle Raisers Association", "TSCRA", "https://tscra.org/", "Ranching 101 classes and the men who will hire you.", "", "2026"),
            c("Your county AgriLife office", "Texas A&M AgriLife Extension", "https://counties.agrilife.org/", "The county agent knows every rancher in the county.", "free", ""),
        ],
        "OK": [
            c("Master Cattleman", "Oklahoma State University Extension", "https://agweb2.agec.okstate.edu/cattleman/index.asp", "County-delivered certification course on the Oklahoma Beef Cattle Manual.", "$175", ""),
            c("Cow-Calf Boot Camp", "Oklahoma State University Extension", "https://ag-events.okstate.edu/event/cow-calf-boot-camp-5157", "Three hands-on days in Ada every April, fifty seats.", "$150 with meals", "April 2026"),
            c("Oklahoma Cattlemen's Association", "OCA", "https://www.okcattlemen.org/", "Fall gatherings, leadership academy, convention.", "", "2026"),
            c("Your county extension office", "Oklahoma State University Extension", "https://extension.okstate.edu/county/", "The county educator knows every rancher in the county.", "free", ""),
        ],
        "MO": [
            c("Grow Your Farm", "University of Missouri Extension", "https://extension.missouri.edu/programs/beginning-farmers-ranchers/training-opportunities", "Eight evening classes and farm tours, plus the ABCs of USDA workshop and internships.", "", "November 2026"),
            c("LandLINK", "FCS Financial", "https://info.myfcsfinancial.com/landlink-young-farmer", "Matches beginning farmers under ten years in with landowners selling or leasing.", "free", ""),
            c("Beginning Farmer Loan Program", "Missouri Department of Agriculture, MASBDA", "https://agriculture.mo.gov/abd/financial/masbda/loan.html", "Tax-exempt bond loans through your lender, and a tax deduction for a landowner who sells or leases to a beginning farmer.", "", ""),
            c("Missouri Cattlemen's Association", "MCA", "https://www.mocattle.org/", "Membership and the Leadership College.", "", "October 2026"),
            c("Your county extension office", "University of Missouri Extension", "https://extension.missouri.edu/counties", "", "free", "2026"),
        ],
        "AR": [
            c("Beginning Farmer and Rancher Development Program", "University of Arkansas at Pine Bluff", "https://uapb.edu/academics/safhs/1890-cooperative-extension/small-farm-program/", "Education, mentoring and technical help for producers under ten years in, twenty counties.", "", "2026"),
            c("Arkansas Cattlemen's Association", "ACA", "https://arbeef.org/", "Education programs, directories, convention.", "", "2025"),
            c("Your county extension office", "University of Arkansas Division of Agriculture", "https://www.uaex.uada.edu/counties/", "", "free", ""),
        ],
        "TN": [
            c("Tennessee Master Beef Producer", "UT Extension, Beef and Forage Center", "https://utbeef.tennessee.edu/tennessee-master-beef-producer-program/", "County beef course; finishing it qualifies you for state cost-share.", "set by county", ""),
            c("TN Farm Link", "Appalachian RC&D Council with the Tennessee Department of Agriculture", "https://tnfarmlink.org/", "Statewide matching of land seekers and landowners.", "free", "2025"),
            c("Tennessee Cattlemen's Association", "TCA", "https://tncattle.org/", "BQA and the Young Cattlemen's Leadership Program.", "", "2026"),
            c("Your county extension office", "UT Extension", "https://utextension.tennessee.edu/office-locations-departments-centers/", "", "free", ""),
        ],
        "KY": [
            c("Kentucky Beef Network", "Kentucky Cattlemen's Association", "https://www.kybeefnetwork.com/", "BQCA certification and producer resources; ask your county office about Master Cattleman.", "", ""),
            c("Beginning Farmer Loan Program", "Kentucky Agricultural Finance Corporation", "https://www.kyagr.com/Content.aspx?PageId=9", "Loans through local lenders for livestock, equipment and land.", "", ""),
            c("Kentucky Cattlemen's Association", "KCA", "https://www.kycattle.org/", "County chapters and membership.", "about $35 a year", ""),
            c("Your county extension office", "University of Kentucky Extension", "https://extension.mgcafe.uky.edu/county", "", "free", "2026"),
        ],
        "KS": [
            c("AgKansitions, Kansas LandLink", "Kansas State University", "https://agkansitions.org/", "Land-link matching, one-on-one help and beginning farmer classes.", "", "2025"),
            c("Farm Beginnings", "Kansas Rural Center", "https://kansasruralcenter.org/farmbeginnings", "Eight-week course, January to March, refundable on completion.", "$300 a farm", "January 2027"),
            c("Beginning Farmer Loan Program", "Kansas Development Finance Authority", "https://kdfa.org/activities/beginning-farmer/", "Tax-exempt bond loans through lenders.", "", "January 2026"),
            c("Kansas Livestock Association", "KLA", "https://www.kla.org/", "Membership and convention.", "", "2026"),
            c("Your county extension office", "K-State Research and Extension", "http://extension.k-state.edu/about/statewide-locations/", "", "free", "July 2026"),
        ],
        "NE": [
            c("Nebraska Land Link", "Nebraska Extension, Center for Agricultural Profitability", "https://cap.unl.edu/landlink/", "Matches beginning ranchers with retiring landowners.", "free", "2026"),
            c("Beef Cow Basics-Plus Online", "Nebraska Extension", "https://beef.unl.edu/producer-education/beef-basics-online-classes/", "Twelve-chapter online course.", "$20 to $120", "2026"),
            c("NextGen Beginning Farmer Tax Credit", "Nebraska Department of Agriculture", "https://nextgen.nebraska.gov/", "A tax credit for owners who lease land or livestock three years or more to a beginner. Use it when you ask for the lease.", "", "October 2025"),
            c("Nebraska Cattlemen", "NC", "https://nebraskacattlemen.org/", "Cattle Edge webinars and leadership training.", "", "2026"),
            c("Your county extension office", "Nebraska Extension", "https://epd.unl.edu/counties", "", "free", "2025"),
        ],
    },
}

# Ranch hand wages: BLS OEWS May 2025, median hourly, national and by state where the state table prints it.
WAGES = {
    "ranch_hand": {"label": "Ranch hand (farmworkers, farm, ranch and aquacultural animals)", "median_hourly": 17.63, "median_annual": 36670,
                   "states": {"TX": {"median_hourly": 16.31, "median_annual": 33920}, "OK": {"median_hourly": 16.19, "median_annual": 33670}, "MO": {"median_hourly": 15.84, "median_annual": 32950}},
                   "source": "wages"},
    "fence": {"label": "Fence erector", "median_hourly": 23.07, "median_annual": 47980, "states": {"TX": {"median_hourly": 17.92}, "OK": {"median_hourly": 18.21}, "MO": {"median_hourly": 20.81}}, "source": "wages"},
    "equipment": {"label": "Agricultural equipment operator", "median_hourly": 20.06, "median_annual": 41730, "states": {"TX": {"median_hourly": 16.47}, "OK": {"median_hourly": 16.78}, "MO": {"median_hourly": 22.35}}, "source": "wages"},
    "truck": {"label": "Truck driver, CDL", "median_hourly": 28.19, "median_annual": 58640, "states": {"TX": {"median_hourly": 27.06}, "OK": {"median_hourly": 26.16}, "MO": {"median_hourly": 26.23}}, "source": "wages"},
}

# Household spending by size of household, BLS CES 2025 Table 1400: total less housing less healthcare, per year.
HOUSEHOLD = {"items": {"1": 50479 - 20492 - 4218, "2": 84124 - 28257 - 7817, "3": 98214 - 31611 - 6658, "4": 108233 - 35229 - 7284, "5": 114427 - 33743 - 7694},
             "note": "Average yearly spending for a household of that size, less housing and healthcare, which the path counts on their own lines. Averages; a lean household spends less.", "source": "household"}

# Marketplace health insurance, 2026 plan year. Enhanced credits expired after 2025 (KFF, October 2026).
ACA = {
    "fpl": {"1": 15960, "2": 21640, "3": 27320, "4": 33000, "5": 38680, "6": 44360, "7": 50040, "8": 55720},
    "applicable_pct": [[0, 133, 2.10, 2.10], [133, 150, 3.14, 4.19], [150, 200, 4.19, 6.60], [200, 250, 6.60, 8.44], [250, 300, 8.44, 9.96], [300, 400.0001, 9.96, 9.96]],
    "benchmark_single": {"US": 625, "TX": 661, "OK": 604, "MO": 605},
    "calculator": {"name": "KFF health insurance marketplace subsidy calculator", "url": "https://www.kff.org/interactive/subsidy-calculator/"},
    "note": "At 100% to 400% of the poverty line a household pays no more than the applicable share of income for the benchmark plan; above 400% there is no credit in 2026.",
    "source": "aca",
}

FOOD = {"single_male_monthly": 338.04, "family_four_monthly": 1024.60, "note": "USDA Thrifty Food Plan, October 2026: a man 20 to 50 living alone $281.70 a month plus the 20% one-person adjustment; a family of four $1,024.60.", "source": "food"}

BUDGET = {"name": "PowerPay, Utah State University Extension", "url": "https://extension.usu.edu/powerpay", "what": "Free debt payoff planner: list what you owe, it orders the payments and shows the payoff date.", "source": "budget"}

JOBS = [
    {"name": "RanchWork.com", "url": "https://ranchwork.com/", "what": "Ranch and outfitter jobs, hand-checked listings, free to browse. Ranch hand jobs in Texas and Oklahoma often come with housing."},
    {"name": "AgCareers.com", "url": "https://www.agcareers.com/", "what": "The big agriculture job board, livestock listings included."},
    {"name": "King Ranch Institute job board", "url": "https://krirm.tamuk.edu/?p=1407", "what": "Ranch manager and foreman jobs, free, for later in the path."},
    {"name": "WorkInTexas.com", "url": "https://www.workintexas.com/", "what": "The Texas Workforce Commission's free statewide job site."},
]

# Medicaid expansion, as of November 2026 (KFF). Adults in expansion states qualify up to 138% of the poverty line.
MEDICAID = {"not_expanded": ["AL", "FL", "GA", "KS", "MS", "SC", "TN", "TX", "WI", "WY"], "limit_pct": 138,
            "note": "In a state that did not expand, a man below the poverty line qualifies for neither Medicaid nor the marketplace credit (healthcare.gov).", "source": "medicaid"}

STAGE = {
    "medicaid": MEDICAID,
    "wages": WAGES,
    "household_by_size": HOUSEHOLD,
    "aca": ACA,
    "food": FOOD,
    "budget": BUDGET,
    "jobs": JOBS,
    "fsa": {
        "experience": "FSA counts a beginning farmer as anyone under ten years in. The direct farm ownership loan wants three years in the business of a farm out of the last ten; a year as a hand with real management duties, a farm management course, military service, or a mentor through SCORE can each stand in for a year of it, and the hand year plus a mentor together waive the rule. Operating loans and microloans ask for less. Write your years down with dates and the men you worked for.",
        "ownership_experience_years": 3,
        "ownership_rate": 6.25,
        "down_payment_rate": 2.25,
        "down_payment_pct": 5,
        "source": "fsa",
    },
    "runway": {"months": 3, "source": "runway"},
    "courses": COURSES,
    "sources": SOURCES,
}

with open(os.path.join(ROOT, "data", "stage.json"), "w", encoding="utf-8") as f:
    json.dump(STAGE, f, indent=1, ensure_ascii=False)
n = len(COURSES["national"]) + sum(len(v) for v in COURSES["states"].values())
print("stage.json written: keys", sorted(STAGE.keys()), "course and resource entries", n)
