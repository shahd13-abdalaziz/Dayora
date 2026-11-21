const form = document.querySelector('.contact_form');

if (form) {
    const nameInput = form.querySelector('input[type="text"]');
    const emailInput = form.querySelector('input[type="email"]');
    const subjectSelect = form.querySelector('select');
    const messageTextarea = form.querySelector('textarea');
    const sendBtn = form.querySelector('.send_button');

    const nameError = form.querySelector('[data-error="name"]');
    const emailError = form.querySelector('[data-error="email"]');

    let subjectError = subjectSelect ? subjectSelect.closest('label').nextElementSibling : null;
    if (subjectSelect && (!subjectError || !subjectError.classList.contains('field_error_msg'))) {
        subjectError = document.createElement('span');
        subjectError.className = 'field_error_msg';
        subjectSelect.closest('label').insertAdjacentElement('afterend', subjectError);
    }

    let messageError = messageTextarea ? messageTextarea.closest('label').nextElementSibling : null;
    if (messageTextarea && (!messageError || !messageError.classList.contains('field_error_msg'))) {
        messageError = document.createElement('span');
        messageError.className = 'field_error_msg';
        messageTextarea.closest('label').insertAdjacentElement('afterend', messageError);
    }

    const statusMsg = document.createElement('p');
    statusMsg.className = 'form_status_msg';
    form.appendChild(statusMsg);

    function getBox(field) {
        return field.closest('.input_box, .input_box_subject_box, .input_box_message_box');
    }

    function getErrorEl(field) {
        if (field === nameInput) return nameError;
        if (field === emailInput) return emailError;
        if (field === subjectSelect) return subjectError;
        if (field === messageTextarea) return messageError;
        return null;
    }

    function setState(field, isValid, msg = '') {
        const box = getBox(field);
        const errEl = getErrorEl(field);
        if (box) {
            box.classList.toggle('is-valid', isValid);
            box.classList.toggle('is-invalid', !isValid);
        }
        if (errEl) {
            errEl.textContent = isValid ? '' : msg;
        }
    }

    function validateField(field) {
        if (!field) return false;
        const val = field.value.trim();

        if (field === nameInput) {
            if (val.length < 2) {
                setState(field, false, 'Please enter your full name.');
                return false;
            }
            setState(field, true);
            return true;
        }

        if (field === emailInput) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(val)) {
                setState(field, false, 'Please enter a valid email address.');
                return false;
            }
            setState(field, true);
            return true;
        }

        if (field === subjectSelect) {
            if (!val) {
                setState(field, false, 'Please select a subject.');
                return false;
            }
            setState(field, true);
            return true;
        }

        if (field === messageTextarea) {
            if (val.length < 10) {
                setState(field, false, 'Message must be at least 10 characters.');
                return false;
            }
            setState(field, true);
            return true;
        }

        return true;
    }

    const allFields = [nameInput, emailInput, subjectSelect, messageTextarea].filter(Boolean);

    allFields.forEach((field) => {
        const ev = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(ev, () => {
            validateField(field);
            statusMsg.textContent = '';
            statusMsg.className = 'form_status_msg';
        });
        field.addEventListener('blur', () => validateField(field));
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const results = allFields.map((f) => validateField(f));
        if (!results.every(Boolean)) {
            statusMsg.textContent = 'Please fix the highlighted fields before sending.';
            statusMsg.className = 'form_status_msg error';
            const firstBad = allFields.find((_, i) => !results[i]);
            if (firstBad) firstBad.focus();
            return;
        }

        statusMsg.textContent = 'Message sent successfully! We will get back to you soon.';
        statusMsg.className = 'form_status_msg success';

        allFields.forEach((f) => {
            f.value = '';
            const box = getBox(f);
            if (box) box.classList.remove('is-valid', 'is-invalid');
            const errEl = getErrorEl(f);
            if (errEl) errEl.textContent = '';
        });

        if (sendBtn) sendBtn.blur();
    });
}