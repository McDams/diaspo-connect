(function () {
  async function init() {
    const resources = await DataStore.getResources();
    const faqs = resources.filter((r) => r.category === "faq").sort((a, b) => a.order - b.order);
    const host = document.getElementById("faq-accordion");
    host.innerHTML = faqs.map((f, i) => `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${i === 0 ? "" : "collapsed"}" type="button" data-bs-toggle="collapse" data-bs-target="#faq-${f.id}">
            ${DCUtils.escapeHtml(f.question)}
          </button>
        </h2>
        <div id="faq-${f.id}" class="accordion-collapse collapse ${i === 0 ? "show" : ""}" data-bs-parent="#faq-accordion">
          <div class="accordion-body text-body-secondary">${DCUtils.escapeHtml(f.answer)}</div>
        </div>
      </div>`).join("");
  }
  document.addEventListener("DOMContentLoaded", init);
})();
