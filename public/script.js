"use strict";

const admissionForm = document.querySelector("#admissionForm");
const motherAlive = document.querySelector("#motherAlive");
const fatherAlive = document.querySelector("#fatherAlive");
const motherDetails = document.querySelector("#motherDetails");
const fatherDetails = document.querySelector("#fatherDetails");
const joiningClass = document.querySelector("#joiningClass");
const previousSchoolSection = document.querySelector("#previousSchoolSection");
const previousSchoolName = document.querySelector("#previousSchoolName");
const previousSchoolNameLabel = document.querySelector(
  "#previousSchoolNameLabel",
);
const previousSchoolHint = document.querySelector("#previousSchoolHint");
const previousSchoolLin = document.querySelector("#previousSchoolLin");
const linRequiredMark = document.querySelector("#linRequiredMark");
const linHint = document.querySelector("#linHint");
const sameAsParentPhone = document.querySelector("#sameAsParentPhone");
const whatsappNumberField = document.querySelector("#whatsappNumberField");
const parentWhatsapp = document.querySelector("#parentWhatsapp");
const hasSupportNeeds = document.querySelector("#hasSupportNeeds");
const supportDetailsField = document.querySelector("#supportDetailsField");
const supportNeeds = document.querySelector("#supportNeeds");
const referralSource = document.querySelector("#referralSource");
const referralDetailsField = document.querySelector("#referralDetailsField");
const referralDetails = document.querySelector("#referralDetails");
const confirmationBox = document.querySelector("#confirmationBox");
const downloadLetter = document.querySelector("#downloadLetter");
const toast = document.querySelector("#toast");

let admissionLetterUrl = "";
let toastTimer;

function setParentAvailability(checkbox, details) {
  details.classList.toggle("disabled", !checkbox.checked);
  details.querySelectorAll("input").forEach((input) => {
    input.disabled = !checkbox.checked;
  });
}

function updateParentDetails() {
  setParentAvailability(motherAlive, motherDetails);
  setParentAvailability(fatherAlive, fatherDetails);
}

function updateJoiningClass() {
  const isSeniorTwo = joiningClass.value === "Senior 2";
  const showPreviousSchool = isSeniorTwo;
  previousSchoolSection.hidden = !showPreviousSchool;
  previousSchoolName.disabled = !showPreviousSchool;
  previousSchoolLin.disabled = !showPreviousSchool;
  previousSchoolName.required = showPreviousSchool;
  previousSchoolNameLabel.textContent = joiningClass.value
    ? "Previous secondary school name"
    : "Previous school name";
  previousSchoolHint.textContent =
    "Enter the secondary school you last attended.";
  previousSchoolLin.required = isSeniorTwo;
  linRequiredMark.hidden = !isSeniorTwo;
  linHint.textContent = isSeniorTwo
    ? "Required for Senior 2 applicants."
    : "Optional for Senior 1 applicants.";
  previousSchoolLin.placeholder = isSeniorTwo
    ? "Enter your LIN"
    : "Enter your LIN if available";
}

function updateWhatsAppField() {
  whatsappNumberField.hidden = sameAsParentPhone.checked;
  parentWhatsapp.disabled = sameAsParentPhone.checked;
}

function updateSupportDetails() {
  supportDetailsField.hidden = !hasSupportNeeds.checked;
  supportNeeds.disabled = !hasSupportNeeds.checked;
}

function updateReferralDetails() {
  const showDetails = referralSource.value === "other";
  referralDetailsField.hidden = !showDetails;
  referralDetails.disabled = !showDetails;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3600);
}

function getFormData() {
  const data = new FormData(admissionForm);
  return Object.fromEntries(data.entries());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatAdmissionLetter(data, admissionId) {
  const value = (field) => data[field]?.trim() || "Not provided";
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Admission Letter - ${escapeHtml(value("studentName"))}</title>
  <style>
    body { max-width: 760px; margin: 40px auto; font-family: Georgia, serif; color: #1a2b3c; line-height: 1.6; }
    .letter { border: 1px solid #dce5ef; padding: 48px; }
    .header { text-align: center; border-bottom: 3px double #143b5a; padding-bottom: 18px; }
    .header h1 { margin: 8px 0 4px; color: #0a1f33; font-size: 24px; }
    .header p { margin: 0; }
    .id { margin: 24px 0; padding: 12px; border: 1px dashed #2d8f5c; text-align: center; color: #146b3c; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; }
    td { padding: 7px 8px; border-bottom: 1px solid #edf2f6; }
    td:first-child { width: 38%; color: #647c93; }
    .footer { margin-top: 28px; }
    @media print { body { margin: 0; } .letter { border: 0; } }
  </style>
</head>
<body>
  <article class="letter">
    <header class="header">
      <p>HEART &amp; HANDS VOCATIONAL SECONDARY SCHOOL</p>
      <h1>ADMISSION APPLICATION RECEIPT</h1>
      <p>2027 Senior One &amp; Two Intake</p>
    </header>
    <div class="id">ADMISSION ID: ${escapeHtml(admissionId)}</div>
    <p>This receipt confirms that the application for <strong>${escapeHtml(value("studentName"))}</strong> has been received. It is not an admission offer.</p>
    <table>
      <tr><td>Student name</td><td>${escapeHtml(value("studentName"))}</td></tr>
      <tr><td>Age</td><td>${escapeHtml(value("age"))}</td></tr>
      <tr><td>Sex</td><td>${escapeHtml(value("sex"))}</td></tr>
      <tr><td>Joining class</td><td>${escapeHtml(value("joiningClass"))}</td></tr>
      <tr><td>Date of birth</td><td>${escapeHtml(value("dateOfBirth"))}</td></tr>
      <tr><td>Nationality</td><td>${escapeHtml(value("nationality"))}</td></tr>
      <tr><td>District</td><td>${escapeHtml(value("district"))}</td></tr>
      <tr><td>Subcounty</td><td>${escapeHtml(value("subcounty"))}</td></tr>
      <tr><td>County</td><td>${escapeHtml(value("county"))}</td></tr>
      <tr><td>Parish</td><td>${escapeHtml(value("parish"))}</td></tr>
      <tr><td>Village</td><td>${escapeHtml(value("village"))}</td></tr>
      <tr><td>Previous school</td><td>${escapeHtml(value("previousSchoolName"))}</td></tr>
      <tr><td>Learner Identification Number (LIN)</td><td>${escapeHtml(value("previousSchoolLin"))}</td></tr>
      <tr><td>Mother</td><td>${escapeHtml(value("motherName"))}</td></tr>
      <tr><td>Father</td><td>${escapeHtml(value("fatherName"))}</td></tr>
      <tr><td>Parent / Guardian contact</td><td>${escapeHtml(value("parentContact"))}</td></tr>
    </table>
    <p>Please keep this admission number for follow-up. If further information or a school visit is needed, the admissions team will contact you using the details provided.</p>
    <div class="footer">
      <p>Issued: ${escapeHtml(date)}</p>
      <p><strong>Mr. Araali Bright Mugume</strong><br>Principal · +256 701 919 400</p>
      <p>Admissions office · +256 789 317 645 · +256 751 764 819</p>
    </div>
  </article>
</body>
</html>`;
}

async function submitAdmission(event) {
  event.preventDefault();

  if (!admissionForm.checkValidity()) {
    admissionForm.reportValidity();
    showToast("Please complete the required fields.");
    return;
  }

  const data = getFormData();
  const submitButton = admissionForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");

  try {
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        motherAlive: motherAlive.checked,
        fatherAlive: fatherAlive.checked,
        parentWhatsapp: sameAsParentPhone.checked
          ? data.parentContact
          : data.parentWhatsapp || "",
      }),
    });
    const responseText = await response.text();
    let result;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        "The server returned an unexpected response. Please try again or contact admissions.",
      );
    }

    if (!response.ok) {
      throw new Error(result.error || "We could not submit your application.");
    }

    const studentName = result.studentName;
    const admissionId = result.admissionNumber;
    data.age = String(result.age);
    document.querySelector("#confirmName").textContent = studentName;
    document.querySelector("#confirmClass").textContent = data.joiningClass;
    document.querySelector("#admissionIdBadge").textContent = admissionId;
    confirmationBox.hidden = false;
    confirmationBox.classList.add("show");

    if (admissionLetterUrl) {
      URL.revokeObjectURL(admissionLetterUrl);
    }

    const letter = formatAdmissionLetter(data, admissionId);
    const blob = new Blob([letter], { type: "text/html;charset=utf-8" });
    admissionLetterUrl = URL.createObjectURL(blob);

    const safeName = studentName
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_|_$/g, "");
    downloadLetter.dataset.filename = `Admission_${safeName || "Student"}_${admissionId}.html`;

    const emailNotice = confirmationBox.querySelector("#emailNotice");
    emailNotice.textContent = result.notifications.applicantEmail.sent
      ? `A receipt was emailed to ${data.studentEmail}. If further details or a school visit are needed, admissions will contact you using the details provided.`
      : "Your application is saved. Email delivery is not available right now; keep your admission number. Admissions can contact you by phone or WhatsApp if needed.";
    confirmationBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(`Application saved. Your admission number is ${admissionId}.`);
  } catch (error) {
    showToast(
      error.message ||
        "We could not submit your application. Please try again.",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
  }
}

function downloadAdmissionLetter() {
  if (!admissionLetterUrl) {
    showToast("Submit the form before downloading.");
    return;
  }

  const link = document.createElement("a");
  link.href = admissionLetterUrl;
  link.download = downloadLetter.dataset.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Admission letter download started.");
}

motherAlive.addEventListener("change", updateParentDetails);
fatherAlive.addEventListener("change", updateParentDetails);
joiningClass.addEventListener("change", updateJoiningClass);
sameAsParentPhone.addEventListener("change", updateWhatsAppField);
hasSupportNeeds.addEventListener("change", updateSupportDetails);
referralSource.addEventListener("change", updateReferralDetails);
admissionForm.addEventListener("submit", submitAdmission);
downloadLetter.addEventListener("click", downloadAdmissionLetter);

window.addEventListener("beforeunload", () => {
  if (admissionLetterUrl) {
    URL.revokeObjectURL(admissionLetterUrl);
  }
});

updateParentDetails();
updateJoiningClass();
updateWhatsAppField();
updateSupportDetails();
updateReferralDetails();
