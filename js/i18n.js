/* Shared English/Arabic interface translation and navbar preference controls. */
(function () {
  "use strict";

  const AR = {
    "Skip to main content": "انتقل إلى المحتوى الرئيسي",
    "Traditional Governance Institutions": "مجموعات الحكم المحلي",
    "Database & Explorer": "قاعدة البيانات والمستكشف",
    "Home": "الرئيسية",
    "Groups": "المجموعات",
    "Interactive Map": "الخريطة التفاعلية",
    "Statistics": "الإحصاءات",
    "Comparison": "المقارنة",
    "About": "عن المشروع",
    "Contact": "اتصل بنا",
    "Toggle navigation": "فتح أو إغلاق قائمة التنقل",
    "Primary navigation": "التنقل الرئيسي",
    "Back to top": "العودة إلى الأعلى",
    "Enter your email": "أدخل بريدك الإلكتروني",
    "Subscribe": "اشتراك",
    "Explore": "استكشف",
    "Project": "المشروع",
    "Data fields": "حقول البيانات",
    "University Graduation Project": "مشروع تخرج جامعي",
    "© 2026 Traditional Governance Institutions Database & Explorer": "© 2026 قاعدة بيانات ومستكشف المؤسسات الحكومية المحلية",
    "© 2026 Traditional Governance Institutions Database & Explorer. All rights reserved.": "© 2026 قاعدة بيانات ومستكشف المؤسسات الحكومية المحلية. جميع الحقوق محفوظة.",

    "Groups Explorer | Traditional Governance Institutions": "مستكشف المجموعات | المؤسسات الحكومية المحلية",
    "Groups Explorer": "مستكشف المجموعات",
    "Search by group name…": "ابحث باسم المجموعة…",
    "Search by group name": "البحث باسم المجموعة",
    "Advanced filters": "مرشحات متقدمة",
    "Country": "الدولة",
    "Continent": "القارة",
    "Region": "المنطقة",
    "Leadership type": "نوع القيادة",
    "Recognition": "الاعتراف الرسمي",
    "All countries": "جميع الدول",
    "All continents": "جميع القارات",
    "All regions": "جميع المناطق",
    "All leadership types": "جميع أنواع القيادة",
    "All statuses": "جميع الحالات",
    "King": "ملك",
    "Chief": "شيخ",
    "Headman": "زعيم محلي",
    "Formally recognized": "معترف بها رسمياً",
    "Not formally recognized": "غير معترف بها رسمياً",
    "Not Available": "غير متاح",
    "Loading records…": "جارٍ تحميل السجلات…",
    "Reset filters": "إعادة ضبط المرشحات",
    "Group": "المجموعة",
    "Population": "السكان",
    "Leadership": "القيادة",
    "Traditional gov.": "حكومة تقليدية",
    "Recognized": "معترف بها",
    "Actions": "الإجراءات",
    "Groups table pagination": "ترقيم صفحات جدول المجموعات",
    "Location": "الموقع",
    "Group details": "تفاصيل المجموعة",
    "Close details": "إغلاق التفاصيل",
    "World distribution map": "خريطة التوزيع العالمي",

    "Statistics | Traditional Governance Institutions": "الإحصاءات | المؤسسات الحكومية المحلية",
    "Dataset Statistics": "إحصاءات مجموعة البيانات",
    "Every total and chart is derived in the browser from": "يتم اشتقاق كل إجمالي ورسم بياني داخل المتصفح من",
    "Countries": "الدول",
    "Continents": "القارات",
    "Regions": "المناطق",
    "Interactive analysis": "تحليل تفاعلي",
    "Analyze by": "تحليل حسب",
    "All Data": "جميع البيانات",
    "Select country": "اختر دولة",
    "Select continent": "اختر قارة",
    "Select region": "اختر منطقة",
    "Reset filters": "إعادة ضبط المرشحات",
    "Current scope": "النطاق الحالي",
    "Loading statistics...": "جارٍ تحميل الإحصاءات...",
    "Statistics could not be loaded. Please try again.": "تعذر تحميل الإحصاءات. يرجى المحاولة مرة أخرى.",
    "No data available": "لا توجد بيانات متاحة",
    "Not applicable for this scope": "لا ينطبق على هذا النطاق",
    "Visual analysis": "تحليل مرئي",
    "Institutional patterns at a glance.": "الأنماط المؤسسية في لمحة.",
    "Leadership types": "أنواع القيادة",
    "Leadership Selection Methods": "طرق اختيار القيادة",
    "Hereditary": "وراثة",
    "Election": "انتخاب",
    "Appointment": "تعيين",
    "Missing": "بيانات مفقودة",
    "Leadership type chart": "رسم بياني لأنواع القيادة",
    "Traditional government functions": "وظائف الحكومة التقليدية",
    "Government functions chart": "رسم بياني لوظائف الحكومة",
    "Formal recognition": "الاعتراف الرسمي",
    "Formal recognition chart": "رسم بياني للاعتراف الرسمي",
    "Interpretation guidance": "إرشادات التفسير",
    "Leadership Types": "أنواع القيادة",
    "Governance Functions": "وظائف الحوكمة",
    "Largest Groups": "أكبر المجموعات",
    "Top Countries": "أكثر الدول",
    "Continent Distribution": "التوزيع حسب القارات",
    "Region Distribution": "التوزيع حسب المناطق",
    "Country Distribution": "التوزيع حسب الدول",
    "Geographic Distribution": "التوزيع الجغرافي",
    "Not Recognized": "غير معترف بها",
    "Missing": "غير متاح",
    "Binary fields are displayed as “Yes” and “No”, while unknown or absent source values are displayed as “Not Available”. Multiple leadership types can be present in one record, so leadership totals may exceed the number of groups.": "تُعرض الحقول الثنائية بصيغة «نعم» و«لا»، بينما تُعرض القيم المجهولة أو الغائبة بصيغة «غير متاح». وقد يحتوي السجل الواحد على أكثر من نوع قيادة، لذلك قد تتجاوز إجماليات القيادة عدد المجموعات.",
    "Inspect underlying records": "استعرض السجلات الأساسية",

    "Comparison | Traditional Governance Institutions": "المقارنة | المؤسسات الحكومية المحلية",
    "Compare Groups": "مقارنة المجموعات",
    "Select any two records and examine their geography, leadership, functions, administrative structure, and formal recognition side by side.": "اختر سجلين وافحص الجغرافيا والقيادة والوظائف والهيكل الإداري والاعتراف الرسمي جنباً إلى جنب.",
    "Group A": "المجموعة أ",
    "Group B": "المجموعة ب",
    "Select first group": "اختر المجموعة الأولى",
    "Select second group": "اختر المجموعة الثانية",
    "Loading groups…": "جارٍ تحميل المجموعات…",
    "Swap selected groups": "تبديل المجموعتين المحددتين",
    "Field": "الحقل",
    "Loading comparison…": "جارٍ تحميل المقارنة…",

    "About the Project | Traditional Governments": "عن المشروع | الحكومات التقليدية",
    "About the Project": "عن المشروع",
    "A modular academic frontend designed to make a structured traditional governments dataset easier to search, interpret, compare, and communicate.": "واجهة أكاديمية معيارية صُممت لتسهيل البحث في بيانات الحكومات التقليدية المنظمة وتفسيرها ومقارنتها وعرضها.",
    "Project purpose": "هدف المشروع",
    "Turning structured records into an accessible research experience.": "تحويل السجلات المنظمة إلى تجربة بحثية سهلة الوصول.",
    "The Traditional Governments Database & Explorer is a university graduation project prototype. It demonstrates how researchers and students could explore a future verified dataset without exposing raw codes or requiring technical database knowledge.": "قاعدة بيانات ومستكشف الحكومات التقليدية نموذج أولي لمشروع تخرج جامعي يوضح كيف يمكن للباحثين والطلاب استكشاف مجموعة بيانات موثقة مستقبلاً دون التعامل مع الرموز الخام أو الحاجة إلى معرفة تقنية بقواعد البيانات.",
    "Discover": "اكتشف",
    "Search and filter records across geography and institutional characteristics.": "ابحث وصفِّ السجلات وفق الخصائص الجغرافية والمؤسسية.",
    "Analyze": "حلّل",
    "Translate binary fields into meaningful counts and visual summaries.": "حوّل الحقول الثنائية إلى أعداد وملخصات مرئية ذات معنى.",
    "Compare": "قارن",
    "Inspect two records side by side with clear difference highlighting.": "افحص سجلين جنباً إلى جنب مع إبراز واضح للاختلافات.",
    "Interface methodology": "منهجية الواجهة",
    "Built around clarity, traceability, and responsible interpretation.": "مبنية على الوضوح وقابلية التتبع والتفسير المسؤول.",
    "Human-readable values": "قيم مفهومة للمستخدم",
    "Binary codes are converted from 1 and 0 into “Yes” and “No” labels throughout the interface.": "تُحوّل الرموز الثنائية 1 و0 إلى تسميات «نعم» و«لا» في جميع أنحاء الواجهة.",
    "Explicit missingness": "إظهار القيم المفقودة",
    "Null and unknown fields are never silently hidden; they appear as “Not Available”.": "لا تُخفى الحقول الفارغة أو المجهولة، بل تظهر بصيغة «غير متاح».",
    "Modular data layer": "طبقة بيانات معيارية",
    "Rendering, filtering, charts, and comparison all read from the same reusable record structure.": "تعتمد عمليات العرض والتصفية والرسوم والمقارنة على بنية سجلات موحدة قابلة لإعادة الاستخدام.",
    "Dataset schema": "مخطط مجموعة البيانات",
    "Fields supported by the prototype.": "الحقول التي يدعمها النموذج الأولي.",
    "The explorer supports geography, group attributes, leadership structures, selection methods, traditional government functions, councils, assemblies, and formal state recognition.": "يدعم المستكشف الجغرافيا وخصائص المجموعات وهياكل القيادة وطرق الاختيار ووظائف الحكومات التقليدية والمجالس والجمعيات والاعتراف الرسمي للدولة.",
    "Group name": "اسم المجموعة",
    "Traditional government present": "وجود حكومة تقليدية",
    "King leadership": "قيادة ملكية",
    "Chief leadership": "قيادة شيخ",
    "Headman leadership": "قيادة زعيم محلي",
    "Inheritance selection": "الاختيار بالوراثة",
    "Election selection": "الاختيار بالانتخاب",
    "Appointment selection": "الاختيار بالتعيين",
    "Land management": "إدارة الأراضي",
    "Dispute resolution": "حل النزاعات",
    "Security": "الأمن",
    "Healing / healthcare": "العلاج / الرعاية الصحية",
    "Council": "مجلس",
    "Community assembly": "جمعية مجتمعية",

    "Contact | Traditional Governments": "اتصل بنا | الحكومات التقليدية",
    "Contact the Project Team": "اتصل بفريق المشروع",
    "Share feedback on the interface, ask about the research direction, or discuss future integration of the verified dataset.": "شارك ملاحظاتك حول الواجهة، أو اسأل عن اتجاه البحث، أو ناقش التكامل المستقبلي لمجموعة البيانات الموثقة.",
    "University project": "مشروع جامعي",
    "Let’s discuss the research.": "لنتحدث عن البحث.",
    "Use this form to share project feedback, dataset questions, or research collaboration enquiries.": "استخدم هذا النموذج لمشاركة ملاحظات المشروع أو الأسئلة المتعلقة بمجموعة البيانات أو استفسارات التعاون البحثي.",
    "Email": "البريد الإلكتروني",
    "Location": "الموقع",
    "Faculty of Computing · University Campus": "كلية الحوسبة · الحرم الجامعي",
    "Project phase": "مرحلة المشروع",
    "Frontend prototype & evaluation": "النموذج الأولي للواجهة والتقييم",
    "Send a message": "أرسل رسالة",
    "Project enquiry form": "نموذج الاستفسار عن المشروع",
    "Full name": "الاسم الكامل",
    "Please enter your name.": "يرجى إدخال اسمك.",
    "Email address": "عنوان البريد الإلكتروني",
    "Please enter a valid email.": "يرجى إدخال بريد إلكتروني صحيح.",
    "Subject": "الموضوع",
    "Select a subject": "اختر موضوعاً",
    "Project feedback": "ملاحظات حول المشروع",
    "Dataset question": "سؤال عن مجموعة البيانات",
    "Future collaboration": "تعاون مستقبلي",
    "Technical integration": "تكامل تقني",
    "Please select a subject.": "يرجى اختيار موضوع.",
    "Message": "الرسالة",
    "Please provide at least 20 characters…": "يرجى كتابة 20 حرفاً على الأقل…",
    "Please enter a message of at least 20 characters.": "يرجى إدخال رسالة لا تقل عن 20 حرفاً.",
    "Send Message": "إرسال الرسالة",
    "Sending...": "جارٍ الإرسال...",
    "Please correct the highlighted fields.": "يرجى تصحيح الحقول المحددة.",
    "Your message has been sent successfully.": "تم إرسال رسالتك بنجاح.",
    "We could not send your message. Please try again later.": "تعذر إرسال رسالتك. يرجى المحاولة مرة أخرى لاحقاً.",

    "A university graduation project for exploring traditional governance systems worldwide.": "مشروع تخرج جامعي لاستكشاف أنظمة الحوكمة التقليدية حول العالم.",
    "Search traditional governance records, combine geographic and institutional filters, sort results, and open a complete field-level view of each group.": "ابحث في سجلات الحوكمة التقليدية، واجمع بين المرشحات الجغرافية والمؤسسية، ورتّب النتائج، وافتح عرضاً تفصيلياً كاملاً لكل مجموعة.",
    "Explore leadership structures, traditional government functions, geographic coverage, and formal recognition through clear statistical summaries.": "استكشف هياكل القيادة ووظائف الحكومات التقليدية والتغطية الجغرافية والاعتراف الرسمي من خلال ملخصات إحصائية واضحة.",
    "Charts summarize the current records and reflect the latest available values.": "تلخص الرسوم السجلات الحالية وتعكس أحدث القيم المتاحة.",
    "Totals for king, chief, and headman leadership.": "إجماليات القيادة الملكية وقيادة الشيوخ والزعماء المحليين.",
    "Frequency of available functional responsibilities across all records.": "تكرار المسؤوليات الوظيفية المتاحة عبر جميع السجلات.",
    "Comparison of state-recognized and non-recognized database records.": "مقارنة سجلات قاعدة البيانات المعترف بها وغير المعترف بها من الدولة.",
    "Continent distribution": "التوزيع حسب القارات",
    "Group totals across the five represented continents.": "إجماليات المجموعات عبر القارات الخمس الممثلة.",
    "Continent distribution chart": "رسم بياني للتوزيع حسب القارات",
    "Largest groups": "أكبر المجموعات",
    "The ten largest groups by population.": "أكبر عشر مجموعات حسب عدد السكان.",
    "Largest groups chart": "رسم بياني لأكبر المجموعات",
    "Top 10 Countries by Number of Traditional Groups": "أكثر 10 دول تضم مجموعات تقليدية",
    "Countries with the highest number of traditional group records.": "الدول التي تضم أكبر عدد من سجلات المجموعات التقليدية.",
    "Top countries chart": "رسم بياني لأكثر الدول التي تضم مجموعات تقليدية",
    "Number of traditional groups": "عدد المجموعات التقليدية",
    "The project presents complex governance information through clear exploration, filtering, visual analysis, and side-by-side comparison tools.": "يقدم المشروع معلومات الحوكمة المعقدة من خلال أدوات واضحة للاستكشاف والتصفية والتحليل المرئي والمقارنة جنباً إلى جنب.",
    "The Traditional Governments Database & Explorer is a university graduation project that helps researchers and students explore structured governance data without exposing raw database codes or requiring technical database knowledge.": "قاعدة بيانات ومستكشف الحكومات التقليدية مشروع تخرج جامعي يساعد الباحثين والطلاب على استكشاف بيانات الحوكمة المنظمة دون عرض رموز قاعدة البيانات الخام أو الحاجة إلى معرفة تقنية بقواعد البيانات.",
    "Current insights": "رؤى حالية",
    "Review current records and summary values across the explorer.": "راجع السجلات الحالية وقيم الملخص عبر المستكشف.",
    "Fields supported by the explorer.": "الحقول التي يدعمها المستكشف.",
    "Explore records": "استكشف السجلات",
    "Dispute resolution (not available in the current database)": "حل النزاعات (غير متاح في قاعدة البيانات الحالية)",
    "{continent}: {total} groups": "{continent}: {total} مجموعة",
    "View groups in {continent}": "عرض مجموعات {continent}",
    "Could not load data. Please try again later.": "تعذر تحميل البيانات. يرجى المحاولة مرة أخرى لاحقاً.",
    "Data unavailable": "البيانات غير متاحة",
    "Americas": "الأمريكيتان",
    "Yes": "نعم",
    "No": "لا",
    "Has traditional government": "لديها حكومة تقليدية",
    "King selected by inheritance": "اختيار الملك بالوراثة",
    "King selected by election": "اختيار الملك بالانتخاب",
    "King selected by appointment": "اختيار الملك بالتعيين",
    "Healthcare / traditional healing": "الرعاية الصحية / العلاج التقليدي",
    "Advisory / decision-making council": "مجلس استشاري / لاتخاذ القرار",
    "Public / community assembly": "جمعية عامة / مجتمعية",
    "Formal state recognition": "اعتراف رسمي من الدولة",
    "Geographic information": "المعلومات الجغرافية",
    "Group information": "معلومات المجموعة",
    "Leadership selection": "اختيار القيادة",
    "Administrative structure": "الهيكل الإداري",
    "Geography & group": "الجغرافيا والمجموعة",
    "Functions": "الوظائف",
    "Recognized": "معترف بها",
    "Not recognized": "غير معترف بها",
    "Not available": "غير متاح",
    "Healing / healthcare": "العلاج / الرعاية الصحية",
    "Previous page": "الصفحة السابقة",
    "Next page": "الصفحة التالية",
    "Page {page}": "الصفحة {page}",
    "View details for {group}": "عرض تفاصيل {group}",
    "No groups match the selected criteria.": "لا توجد مجموعات تطابق المعايير المحددة.",
    "Thank you. Your email was captured in this demonstration.": "شكراً لك. تم تسجيل بريدك الإلكتروني في هذا النموذج التجريبي.",
    "Africa": "أفريقيا",
    "Asia": "آسيا",
    "Europe": "أوروبا",
    "North America": "أمريكا الشمالية",
    "South America": "أمريكا الجنوبية",
    "Oceania": "أوقيانوسيا",
    "Botswana": "بوتسوانا",
    "Cameroon": "الكاميرون",
    "Chile": "تشيلي",
    "Ghana": "غانا",
    "Indonesia": "إندونيسيا",
    "Kenya": "كينيا",
    "Morocco": "المغرب",
    "New Zealand": "نيوزيلندا",
    "Nigeria": "نيجيريا",
    "Norway": "النرويج",
    "Oman": "عُمان",
    "Peru": "بيرو",
    "Philippines": "الفلبين",
    "South Africa": "جنوب أفريقيا",
    "Uganda": "أوغندا",
    "United States": "الولايات المتحدة",
    "Andean South America": "منطقة الأنديز بأمريكا الجنوبية",
    "Eastern Africa": "شرق أفريقيا",
    "Middle Africa": "وسط أفريقيا",
    "Northern Africa": "شمال أفريقيا",
    "Northern America": "أمريكا الشمالية",
    "Northern Europe": "شمال أوروبا",
    "Polynesia": "بولينيزيا",
    "South-eastern Asia": "جنوب شرق آسيا",
    "Southern Africa": "جنوب أفريقيا",
    "Southern South America": "جنوب أمريكا الجنوبية",
    "Western Africa": "غرب أفريقيا",
    "Western Asia": "غرب آسيا"
  };

  const TITLE_AR = {
    "index.html": "قاعدة بيانات ومستكشف الحكومات التقليدية",
    "groups.html": AR["Groups Explorer | Traditional Governments"],
    "statistics.html": AR["Statistics | Traditional Governments"],
    "comparison.html": AR["Comparison | Traditional Governments"],
    "about.html": AR["About the Project | Traditional Governments"],
    "contact.html": AR["Contact | Traditional Governments"]
  };

  function language() {
    return window.SitePreferences?.getLanguage() || "en";
  }

  function translate(value) {
    if (language() !== "ar" || value == null) return String(value ?? "");
    return AR[String(value)] || String(value);
  }

  function t(value, variables = {}) {
    let output = translate(value);
    Object.entries(variables).forEach(([key, replacement]) => {
      output = output.replaceAll(`{${key}}`, replacement);
    });
    return output;
  }

  function replaceTextNode(node) {
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed || !AR[trimmed]) return;
    const start = original.match(/^\s*/)?.[0] || "";
    const end = original.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${start}${translate(trimmed)}${end}`;
  }

  function translateElement(element) {
    if (element.matches("script, style, code, canvas")) return;
    if (element.dataset.enTitle && element.dataset.arTitle) {
      element.setAttribute("aria-label", language() === "ar" ? element.dataset.arTitle : element.dataset.enTitle);
    }
    if (element.dataset.en && element.dataset.ar) {
      element.textContent = language() === "ar" ? element.dataset.ar : element.dataset.en;
      return;
    }
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const value = element.getAttribute(attribute);
      const translated = translate(value);
      if (translated !== value) element.setAttribute(attribute, translated);
    });
  }

  function translateTree(root = document.body) {
    if (!root) return;
    translateElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.parentElement?.closest("script, style, code, canvas")) replaceTextNode(node);
      } else {
        translateElement(node);
      }
      node = walker.nextNode();
    }
  }

  function createPreferenceControls() {
    const navShell = document.querySelector(".nav-shell");
    if (!navShell) return;

    let controls = document.querySelector(".site-preference-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "site-preference-controls";
      controls.innerHTML = `
        <button class="language-switch" id="languageSwitch" type="button">
          <i class="bi bi-globe2" aria-hidden="true"></i>
          <span id="languageLabel"></span>
          <i class="bi bi-chevron-down" aria-hidden="true"></i>
        </button>
        <button class="theme-switch" id="themeSwitch" type="button"><i class="bi" aria-hidden="true"></i></button>`;
      navShell.appendChild(controls);
    } else {
      controls.classList.add("site-preference-controls");
    }

    const languageButton = document.querySelector("#languageSwitch");
    const languageLabel = document.querySelector("#languageLabel");
    const themeButton = document.querySelector("#themeSwitch");
    const isArabic = language() === "ar";
    const isDark = window.SitePreferences?.getTheme() === "dark";

    if (languageLabel) languageLabel.textContent = isArabic ? "English" : "العربية";
    if (languageButton) {
      languageButton.setAttribute("aria-label", isArabic ? "Switch to English" : "التبديل إلى العربية");
      languageButton.addEventListener("click", () => {
        window.SitePreferences.setLanguage(isArabic ? "en" : "ar");
        window.location.reload();
      });
    }

    if (themeButton) {
      themeButton.innerHTML = `<i class="bi ${isDark ? "bi-sun-fill" : "bi-moon-fill"}" aria-hidden="true"></i>`;
      themeButton.setAttribute("aria-label", isDark
        ? (isArabic ? "تفعيل الوضع الفاتح" : "Enable light mode")
        : (isArabic ? "تفعيل الوضع الداكن" : "Enable dark mode"));
      themeButton.addEventListener("click", () => {
        window.SitePreferences.setTheme(isDark ? "light" : "dark");
        window.location.reload();
      });
    }
  }

  function translateDocumentTitle() {
    const file = window.location.pathname.split("/").pop() || "index.html";
    if (language() === "ar" && TITLE_AR[file]) document.title = TITLE_AR[file];
  }

  window.SiteI18n = { AR, t, translate, translateTree, language };

  document.addEventListener("DOMContentLoaded", () => {
    createPreferenceControls();
    translateTree();
    translateDocumentTitle();
    document.documentElement.classList.remove("preferences-pending");
    document.dispatchEvent(new CustomEvent("site:i18n-ready", { detail: { language: language() } }));
  });
})();
