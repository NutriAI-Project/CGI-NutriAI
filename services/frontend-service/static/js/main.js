/**
 * NutriAI Health Portal - Main JavaScript
 * Handles drag-and-drop uploads, OCR polling, diet plan generation,
 * flash messages, chart initialization, and UI interactions.
 */

document.addEventListener('DOMContentLoaded', function () {
    initFlashMessages();
    initUploadZone();
    initOCRPolling();
    initDeleteModals();
    initAllergyDelete();
    initNotificationBadge();
});

/* ============================================================
   Flash Messages - Auto-dismiss after 4 seconds
   ============================================================ */
function initFlashMessages() {
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(function (msg) {
        setTimeout(function () {
            msg.classList.add('dismissing');
            setTimeout(function () {
                msg.remove();
            }, 300);
        }, 4000);
    });
}

function showFlash(message, type) {
    type = type || 'success';
    const container = document.getElementById('flash-container');
    if (!container) return;

    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-' + type + ' alert-dismissible flash-message';
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML =
        message +
        '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';

    container.prepend(alertDiv);

    setTimeout(function () {
        alertDiv.classList.add('dismissing');
        setTimeout(function () {
            alertDiv.remove();
        }, 300);
    }, 4000);
}

/* ============================================================
   Drag & Drop Upload Zone
   ============================================================ */
function initUploadZone() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');

    if (!uploadZone || !fileInput) return;

    // Click to open file dialog
    uploadZone.addEventListener('click', function () {
        fileInput.click();
    });

    // Drag events
    uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');

        var files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });
}

function handleFileUpload(file) {
    // Validate file type
    var allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    var allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    var ext = file.name.split('.').pop().toLowerCase();

    if (allowedExtensions.indexOf(ext) === -1) {
        showFlash('Invalid file type. Only PDF, PNG, JPG, JPEG files are allowed.', 'danger');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showFlash('File size exceeds 10MB limit.', 'danger');
        return;
    }

    // Get document type
    var docTypeSelect = document.getElementById('document-type');
    var docType = docTypeSelect ? docTypeSelect.value : 'other';

    // Create FormData and upload
    var formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', docType);

    var uploadZone = document.getElementById('upload-zone');
    var uploadProgress = document.getElementById('upload-progress');

    if (uploadZone) uploadZone.style.display = 'none';
    if (uploadProgress) uploadProgress.style.display = 'block';

    fetch('/documents/upload', {
        method: 'POST',
        body: formData,
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                showFlash(data.message || 'Document uploaded successfully!', 'success');
                setTimeout(function () {
                    window.location.reload();
                }, 1500);
            }
        })
        .catch(function (error) {
            console.error('Upload error:', error);
            showFlash('Upload failed. Please try again.', 'danger');
        })
        .finally(function () {
            if (uploadZone) uploadZone.style.display = 'block';
            if (uploadProgress) uploadProgress.style.display = 'none';
        });
}

/* ============================================================
   OCR Status Polling - Every 5 seconds
   ============================================================ */
function initOCRPolling() {
    var statusElements = document.querySelectorAll('[data-ocr-status]');
    var pendingDocs = [];

    statusElements.forEach(function (el) {
        var status = el.getAttribute('data-ocr-status');
        if (status === 'pending' || status === 'processing') {
            pendingDocs.push({
                element: el,
                documentId: el.getAttribute('data-document-id'),
            });
        }
    });

    if (pendingDocs.length > 0) {
        setInterval(function () {
            pollOCRStatus(pendingDocs);
        }, 5000);
    }
}

function pollOCRStatus(pendingDocs) {
    pendingDocs.forEach(function (doc) {
        fetch('/documents/' + doc.documentId + '/status')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.ocr_status !== doc.element.getAttribute('data-ocr-status')) {
                    doc.element.setAttribute('data-ocr-status', data.ocr_status);
                    updateStatusBadge(doc.element, data.ocr_status);

                    if (data.ocr_status === 'completed' || data.ocr_status === 'failed') {
                        showFlash(
                            'Document processing ' + data.ocr_status + '!',
                            data.ocr_status === 'completed' ? 'success' : 'danger'
                        );
                    }
                }
            })
            .catch(function (error) {
                console.error('Polling error:', error);
            });
    });
}

function updateStatusBadge(element, status) {
    var badgeClasses = {
        pending: 'badge-status badge-pending',
        processing: 'badge-status badge-processing',
        completed: 'badge-status badge-completed',
        failed: 'badge-status badge-failed',
    };

    var badgeTexts = {
        pending: 'Pending',
        processing: 'Processing',
        completed: 'Completed',
        failed: 'Failed',
    };

    element.className = badgeClasses[status] || 'badge-status';
    element.textContent = badgeTexts[status] || status;
}

/* ============================================================
   Diet Plan Generation
   ============================================================ */
function generateDietPlan() {
    var checkboxes = document.querySelectorAll('input[name="document_ids"]:checked');
    if (checkboxes.length === 0) {
        showFlash('Please select at least one document.', 'warning');
        return;
    }

    var formData = new FormData();
    checkboxes.forEach(function (cb) {
        formData.append('document_ids', cb.value);
    });

    var additionalNotes = document.getElementById('additional-notes');
    if (additionalNotes) {
        formData.append('additional_notes', additionalNotes.value);
    }

    // Show loading state
    var generateBtn = document.getElementById('generate-btn');
    var loadingContainer = document.getElementById('loading-container');
    var resultContainer = document.getElementById('result-container');

    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.classList.add('btn-generate-loading');
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';
    }
    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (resultContainer) resultContainer.style.display = 'none';

    fetch('/diet-plan/generate', {
        method: 'POST',
        body: formData,
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                displayDietPlan(data);
                showFlash('Diet plan generated successfully!', 'success');
            }
        })
        .catch(function (error) {
            console.error('Generation error:', error);
            showFlash('Failed to generate diet plan. Please try again.', 'danger');
        })
        .finally(function () {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.classList.remove('btn-generate-loading');
                generateBtn.innerHTML = '<i class="fas fa-magic me-2"></i>Generate Diet Plan';
            }
            if (loadingContainer) loadingContainer.style.display = 'none';
        });
}

function displayDietPlan(data) {
    var resultContainer = document.getElementById('result-container');
    if (!resultContainer) return;

    var html = '';

    // Plan Title & Summary
    html += '<div class="content-card diet-result-card mb-4">';
    html += '<h4 class="text-primary-green mb-2"><i class="fas fa-utensils me-2"></i>' + escapeHtml(data.plan_title) + '</h4>';
    html += '<p class="text-muted">' + escapeHtml(data.plan_summary || '') + '</p>';
    if (data.plan_id) {
        html += '<a href="/diet-plan/' + data.plan_id + '/pdf" class="btn btn-nutriai-outline btn-sm mt-2">';
        html += '<i class="fas fa-download me-1"></i>Download PDF</a>';
    }
    html += '</div>';

    // Weekly Meal Plan
    if (data.weekly_meal_plan) {
        html += '<div class="content-card diet-result-card mb-4">';
        html += '<h5 class="text-secondary-blue mb-3"><i class="fas fa-calendar-week me-2"></i>Weekly Meal Plan</h5>';
        html += '<div class="accordion meal-plan-accordion" id="mealPlanAccordion">';
        var days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach(function (day, index) {
            var dayPlan = data.weekly_meal_plan[day];
            if (dayPlan) {
                var isFirst = index === 0;
                html += '<div class="accordion-item">';
                html += '<h2 class="accordion-header"><button class="accordion-button ' + (isFirst ? '' : 'collapsed') + '" type="button" data-bs-toggle="collapse" data-bs-target="#day-' + day + '">';
                html += '<i class="fas fa-calendar-day me-2"></i>' + day.charAt(0).toUpperCase() + day.slice(1);
                html += '</button></h2>';
                html += '<div id="day-' + day + '" class="accordion-collapse collapse ' + (isFirst ? 'show' : '') + '" data-bs-parent="#mealPlanAccordion">';
                html += '<div class="accordion-body">';
                html += '<p><strong>🌅 Breakfast:</strong> ' + escapeHtml(dayPlan.breakfast || '') + '</p>';
                html += '<p><strong>☀️ Lunch:</strong> ' + escapeHtml(dayPlan.lunch || '') + '</p>';
                html += '<p><strong>🌙 Dinner:</strong> ' + escapeHtml(dayPlan.dinner || '') + '</p>';
                html += '<p><strong>🍎 Snacks:</strong> ' + escapeHtml(dayPlan.snacks || '') + '</p>';
                html += '</div></div></div>';
            }
        });
        html += '</div></div>';
    }

    // Foods to Eat
    if (data.foods_to_eat && data.foods_to_eat.length > 0) {
        html += '<div class="content-card foods-eat-card diet-result-card mb-4">';
        html += '<h5 class="text-primary-green mb-3"><i class="fas fa-check-circle me-2"></i>Foods to Eat</h5>';
        html += '<div class="table-responsive"><table class="table table-nutriai">';
        html += '<thead><tr><th>Food</th><th>Reason</th><th>Portion</th><th>Timing</th></tr></thead><tbody>';
        data.foods_to_eat.forEach(function (food) {
            html += '<tr>';
            html += '<td><strong>' + escapeHtml(food.food_name) + '</strong></td>';
            html += '<td>' + escapeHtml(food.reason || '') + '</td>';
            html += '<td>' + escapeHtml(food.portion_size || '') + '</td>';
            html += '<td>' + escapeHtml(food.timing || '') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div></div>';
    }

    // Foods to Avoid
    if (data.foods_to_avoid && data.foods_to_avoid.length > 0) {
        html += '<div class="content-card foods-avoid-card diet-result-card mb-4">';
        html += '<h5 class="text-danger mb-3"><i class="fas fa-times-circle me-2"></i>Foods to Avoid</h5>';
        html += '<div class="table-responsive"><table class="table table-nutriai">';
        html += '<thead><tr><th>Food</th><th>Reason</th><th>Risk Level</th></tr></thead><tbody>';
        data.foods_to_avoid.forEach(function (food) {
            var riskClass = food.risk_level === 'high' ? 'text-danger' : food.risk_level === 'medium' ? 'text-warning' : 'text-info';
            html += '<tr>';
            html += '<td><strong>' + escapeHtml(food.food_name) + '</strong></td>';
            html += '<td>' + escapeHtml(food.reason || '') + '</td>';
            html += '<td><span class="badge ' + (food.risk_level === 'high' ? 'bg-danger' : food.risk_level === 'medium' ? 'bg-warning text-dark' : 'bg-info') + '">' + escapeHtml(food.risk_level || '') + '</span></td>';
            html += '</tr>';
        });
        html += '</tbody></table></div></div>';
    }

    // Nutritional Guidelines
    if (data.nutritional_guidelines) {
        var ng = data.nutritional_guidelines;
        html += '<div class="content-card diet-result-card mb-4">';
        html += '<h5 class="text-primary-green mb-3"><i class="fas fa-chart-pie me-2"></i>Nutritional Guidelines</h5>';
        html += '<div class="row g-3">';
        var guidelines = [
            { label: 'Daily Calories', value: ng.daily_calories, unit: 'kcal', icon: 'fa-fire', color: 'orange' },
            { label: 'Protein', value: ng.protein_grams, unit: 'g', icon: 'fa-drumstick-bite', color: 'green' },
            { label: 'Carbs', value: ng.carbs_grams, unit: 'g', icon: 'fa-bread-slice', color: 'blue' },
            { label: 'Fats', value: ng.fats_grams, unit: 'g', icon: 'fa-cheese', color: 'teal' },
            { label: 'Fiber', value: ng.fiber_grams, unit: 'g', icon: 'fa-seedling', color: 'green' },
            { label: 'Water', value: ng.water_liters, unit: 'L', icon: 'fa-tint', color: 'blue' },
        ];
        guidelines.forEach(function (g) {
            if (g.value) {
                html += '<div class="col-6 col-md-4">';
                html += '<div class="text-center p-3 rounded" style="background: var(--bg-light);">';
                html += '<i class="fas ' + g.icon + ' text-primary-green mb-1" style="font-size:1.3rem;"></i>';
                html += '<div class="fw-bold" style="font-size:1.3rem;">' + g.value + ' <small class="text-muted">' + g.unit + '</small></div>';
                html += '<small class="text-muted">' + g.label + '</small>';
                html += '</div></div>';
            }
        });
        html += '</div></div>';
    }

    // Allergy Notes
    if (data.allergy_notes && data.allergy_notes.length > 0) {
        html += '<div class="content-card diet-result-card mb-4" style="border-left: 4px solid #EF6C00;">';
        html += '<h5 class="mb-3" style="color: #EF6C00;"><i class="fas fa-exclamation-triangle me-2"></i>Allergy Notes</h5>';
        html += '<ul class="mb-0">';
        data.allergy_notes.forEach(function (note) {
            html += '<li class="mb-1">' + escapeHtml(note) + '</li>';
        });
        html += '</ul></div>';
    }

    // Additional Recommendations
    if (data.additional_recommendations && data.additional_recommendations.length > 0) {
        html += '<div class="content-card diet-result-card mb-4" style="border-left: 4px solid var(--secondary-blue);">';
        html += '<h5 class="text-secondary-blue mb-3"><i class="fas fa-lightbulb me-2"></i>Additional Recommendations</h5>';
        html += '<ul class="mb-0">';
        data.additional_recommendations.forEach(function (rec) {
            html += '<li class="mb-1">' + escapeHtml(rec) + '</li>';
        });
        html += '</ul></div>';
    }

    resultContainer.innerHTML = html;
    resultContainer.style.display = 'block';
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   Delete Modals
   ============================================================ */
function initDeleteModals() {
    var deleteModal = document.getElementById('deleteModal');
    if (!deleteModal) return;

    deleteModal.addEventListener('show.bs.modal', function (event) {
        var button = event.relatedTarget;
        var docId = button.getAttribute('data-document-id');
        var docName = button.getAttribute('data-document-name');

        document.getElementById('delete-doc-name').textContent = docName;
        document.getElementById('confirm-delete-btn').setAttribute('data-document-id', docId);
    });

    var confirmBtn = document.getElementById('confirm-delete-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
            var docId = this.getAttribute('data-document-id');
            deleteDocument(docId);
        });
    }
}

function deleteDocument(documentId) {
    fetch('/documents/' + documentId, {
        method: 'DELETE',
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                showFlash(data.message || 'Document deleted.', 'success');
                var modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                if (modal) modal.hide();
                setTimeout(function () {
                    window.location.reload();
                }, 1000);
            }
        })
        .catch(function (error) {
            console.error('Delete error:', error);
            showFlash('Failed to delete document.', 'danger');
        });
}

/* ============================================================
   Allergy Delete
   ============================================================ */
function initAllergyDelete() {
    document.querySelectorAll('.delete-allergy').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var allergyId = this.getAttribute('data-allergy-id');
            if (confirm('Are you sure you want to remove this allergy?')) {
                deleteAllergy(allergyId);
            }
        });
    });
}

function deleteAllergy(allergyId) {
    fetch('/profile/allergy/' + allergyId, {
        method: 'DELETE',
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                showFlash(data.message || 'Allergy removed.', 'success');
                setTimeout(function () {
                    window.location.reload();
                }, 1000);
            }
        })
        .catch(function (error) {
            console.error('Delete allergy error:', error);
            showFlash('Failed to remove allergy.', 'danger');
        });
}

/* ============================================================
   Health Tracker Forms
   ============================================================ */
function submitHealthLog(event) {
    event.preventDefault();
    var form = event.target;
    var formData = new FormData(form);

    fetch('/health-tracker/log', {
        method: 'POST',
        body: formData,
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                showFlash(data.message || 'Health log saved!', 'success');
                setTimeout(function () {
                    window.location.reload();
                }, 1500);
            }
        })
        .catch(function (error) {
            console.error('Health log error:', error);
            showFlash('Failed to save health log.', 'danger');
        });
}

function submitMealLog(event) {
    event.preventDefault();
    var form = event.target;
    var formData = new FormData(form);

    fetch('/health-tracker/meal', {
        method: 'POST',
        body: formData,
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                showFlash(data.message || 'Meal log saved!', 'success');
                setTimeout(function () {
                    window.location.reload();
                }, 1500);
            }
        })
        .catch(function (error) {
            console.error('Meal log error:', error);
            showFlash('Failed to save meal log.', 'danger');
        });
}

/* ============================================================
   Chart.js Initialization Helpers
   ============================================================ */
function initWeightChart(labels, data) {
    var ctx = document.getElementById('weightChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Weight (kg)',
                data: data,
                borderColor: '#2E7D32',
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2E7D32',
                pointBorderWidth: 2,
                pointRadius: 4,
            }],
        },
        options: {
            responsive: true,
            animation: { duration: 1500, easing: 'easeOutQuart' },
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } },
            },
        },
    });
}

function initBloodSugarChart(labels, fasting, postprandial) {
    var ctx = document.getElementById('bloodSugarChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Fasting (mg/dL)',
                    data: fasting,
                    borderColor: '#1565C0',
                    backgroundColor: 'rgba(21, 101, 192, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                },
                {
                    label: 'Postprandial (mg/dL)',
                    data: postprandial,
                    borderColor: '#EF6C00',
                    backgroundColor: 'rgba(239, 108, 0, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            animation: { duration: 1500, easing: 'easeOutQuart' },
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } },
            },
        },
    });
}

function initBloodPressureChart(labels, systolic, diastolic) {
    var ctx = document.getElementById('bloodPressureChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Systolic (mmHg)',
                    data: systolic,
                    borderColor: '#C62828',
                    backgroundColor: 'rgba(198, 40, 40, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                },
                {
                    label: 'Diastolic (mmHg)',
                    data: diastolic,
                    borderColor: '#00897B',
                    backgroundColor: 'rgba(0, 137, 123, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            animation: { duration: 1500, easing: 'easeOutQuart' },
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } },
            },
        },
    });
}

/* ============================================================
   Admin - Toggle User Status
   ============================================================ */
function toggleUserStatus(userId) {
    fetch('/admin/users/' + userId + '/toggle', {
        method: 'POST',
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.error) {
                showFlash(data.error, 'danger');
            } else {
                showFlash(data.message, 'success');
                setTimeout(function () {
                    window.location.reload();
                }, 1000);
            }
        })
        .catch(function (error) {
            console.error('Toggle error:', error);
            showFlash('Failed to update user status.', 'danger');
        });
}

/* ============================================================
   Notification Badge
   ============================================================ */
function initNotificationBadge() {
    var badge = document.getElementById('notification-badge');
    if (!badge) return;

    // Poll notification count every 30 seconds
    setInterval(function () {
        fetch('/notifications/count')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.count > 0) {
                    badge.textContent = data.count;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            })
            .catch(function () { });
    }, 30000);
}

/* ============================================================
   Utility Functions
   ============================================================ */
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
