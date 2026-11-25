(function () {
  "use strict";

  function normalizeDigits(value) {
    const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
    const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
    return String(value || "")
      .replace(/[٠-٩]/g, ch => String(arabicIndic.indexOf(ch)))
      .replace(/[۰-۹]/g, ch => String(easternArabicIndic.indexOf(ch)))
      .replace(/[\s-]/g, "");
  }

  function getEgyptianNationalIdGender(rawId) {
    const id = normalizeDigits(rawId);
    if (!/^\d{14}$/.test(id)) {
      throw new Error("يجب أن يتكون الرقم القومي من 14 رقمًا.");
    }

    const centuryCode = id[0];
    if (centuryCode !== "2" && centuryCode !== "3") {
      throw new Error("صيغة الرقم القومي غير صحيحة: رقم القرن غير صالح.");
    }

    const year = Number((centuryCode === "2" ? "19" : "20") + id.slice(1, 3));
    const month = Number(id.slice(3, 5));
    const day = Number(id.slice(5, 7));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error("تاريخ الميلاد الموجود داخل الرقم القومي غير صالح.");
    }

    const governorate = id.slice(7, 9);
    const validGovernorates = new Set([
      "01", "02", "03", "04", "11", "12", "13", "14", "15", "16", "17", "18", "19",
      "21", "22", "23", "24", "25", "26", "27", "28", "29", "31", "32", "33", "34", "35", "88"
    ]);
    if (!validGovernorates.has(governorate)) {
      throw new Error("كود المحافظة الموجود داخل الرقم القومي غير معروف.");
    }

    // الرقم الثالث عشر (index 12): فردي = ذكر، زوجي = أنثى.
    // هذا فحص تنسيق فقط، وليس تحققاً حكومياً من صحة الهوية.
    return Number(id[12]) % 2 === 0 ? "female" : "male";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value == null ? "" : String(value);
  }

  async function loadVerificationQr(image, src) {
    image.src = src;
    if (image.complete && image.naturalWidth > 0) return;
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error("تعذر تحميل رمز QR الخاص بالتحقق.")), { once: true });
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("صورة QR غير صالحة أو فارغة.");
    }
  }

  async function renderCertificate(data) {
    const gender = getEgyptianNationalIdGender(data.nationalId);
    const isFemale = gender === "female";
    const serial = String(data.certificateSerial || "").trim();
    const verificationUrl = String(data.verificationUrl || "").trim();
    const qrSrc = String(data.verificationQrSrc || "").trim();

    if (!serial) throw new Error("سيريال الشهادة غير موجود.");
    if (!verificationUrl) throw new Error("رابط التحقق من الشهادة غير موجود.");
    if (!qrSrc) throw new Error("صورة QR للتحقق من الشهادة غير موجودة.");

    setText("student-name", data.studentName);
    setText("student-label", isFemale ? "الطالبة" : "الطالب");
    setText("completion-verb", isFemale ? "قد اجتازت بنجاح الدورة التدريبية" : "قد اجتاز بنجاح الدورة التدريبية");
    setText("course-name", data.courseName);
    setText("completion-period", `${data.completionMonth} ${data.completionYear}  (بواقع ${data.trainingHours} ساعة)`);
    setText("chairman-name", data.chairmanName);
    setText("dean-name", data.deanName);
    setText("unit-manager-name", data.unitManagerName);
    setText("certificate-serial", serial);

    const qrImage = document.getElementById("verification-qr");
    const qrLink = document.getElementById("verification-link");
    qrLink.href = verificationUrl;
    qrLink.title = `التحقق من الشهادة ${serial}`;
    await loadVerificationQr(qrImage, qrSrc);

    document.documentElement.dataset.gender = gender;
    document.body.classList.add("certificate-ready");
  }

  window.getEgyptianNationalIdGender = getEgyptianNationalIdGender;
  window.renderCertificate = renderCertificate;

  document.addEventListener("DOMContentLoaded", async function () {
    const data = window.certificateData;
    const errorBox = document.getElementById("certificate-error");
    try {
      if (!data) throw new Error("لم يتم تحميل ملف بيانات الشهادة.");
      if (!String(data.studentName || "").trim()) throw new Error("اسم الطالب غير موجود.");
      if (!String(data.courseName || "").trim()) throw new Error("اسم الدورة غير موجود.");
      if (!Number.isFinite(Number(data.trainingHours)) || Number(data.trainingHours) <= 0) throw new Error("عدد ساعات التدريب غير صالح.");
      await renderCertificate(data);
      errorBox.hidden = true;
    } catch (error) {
      errorBox.textContent = `تعذر إنشاء الشهادة: ${error.message}`;
      errorBox.hidden = false;
      document.body.classList.add("certificate-invalid");
    }
  });
})();
