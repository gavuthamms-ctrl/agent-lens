/**
 * AgentLens Chart.js Manager
 */
const ChartManager = {
  instances: {},

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#0f172a' : '#ffffff',
      tooltipText: isDark ? '#ffffff' : '#0f172a',
    };
  },

  destroy(canvasId) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
      delete this.instances[canvasId];
    }
  },

  renderDefectsByType(canvasId, typeCounts) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();
    const labels = Object.keys(typeCounts).map(k => k.replace(/_/g, ' '));
    const data = Object.values(typeCounts);

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Defect Frequency',
          data: data,
          backgroundColor: 'rgba(99, 102, 241, 0.65)',
          borderColor: '#6366f1',
          borderWidth: 1.5,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: '#6366f1',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              color: theme.textColor,
              font: { size: 10, family: 'Inter' },
              maxRotation: 45,
              minRotation: 25,
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: theme.textColor,
              font: { size: 11, family: 'Inter' },
              stepSize: 1,
            },
            grid: { color: theme.gridColor },
          },
        },
      },
    });
  },

  renderDefectsBySeverity(canvasId, severityCounts) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();
    const labels = ['Critical', 'High', 'Medium', 'Low'];
    const data = [
      severityCounts.critical || 0,
      severityCounts.high || 0,
      severityCounts.medium || 0,
      severityCounts.low || 0,
    ];

    this.instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#ef4444', '#f97316', '#eab308', '#0ea5e9'],
          borderColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#0f172a',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { size: 11, family: 'Inter' },
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
          },
        },
        cutout: '65%',
      },
    });
  },

  renderDefectsByAgent(canvasId, agentCounts) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();
    const labels = Object.keys(agentCounts);
    const data = Object.values(agentCounts);

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Defects Involved',
          data: data,
          backgroundColor: 'rgba(249, 115, 22, 0.65)',
          borderColor: '#f97316',
          borderWidth: 1.5,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: theme.textColor,
              font: { size: 10, family: 'Inter' },
              stepSize: 1,
            },
            grid: { color: theme.gridColor },
          },
          y: {
            ticks: {
              color: theme.textColor,
              font: { size: 11, family: 'Inter' },
            },
            grid: { display: false },
          },
        },
      },
    });
  },

  renderEvaluationChart(canvasId, perTypeMetrics) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();
    // Only display types that have ground truth or detections
    const active = perTypeMetrics.filter(m => m.ground_truth_count > 0 || m.detected_count > 0);
    const displayList = active.length > 0 ? active : perTypeMetrics.slice(0, 5);

    const labels = displayList.map(m => m.defect_type.replace(/_/g, ' '));
    const precisionData = displayList.map(m => Math.round(m.precision * 100));
    const recallData = displayList.map(m => Math.round(m.recall * 100));
    const f1Data = displayList.map(m => Math.round(m.f1_score * 100));

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Precision (%)',
            data: precisionData,
            backgroundColor: 'rgba(14, 165, 233, 0.75)',
            borderColor: '#0ea5e9',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Recall (%)',
            data: recallData,
            backgroundColor: 'rgba(234, 179, 8, 0.75)',
            borderColor: '#eab308',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'F1 Score (%)',
            data: f1Data,
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.textColor,
              font: { size: 11, family: 'Inter' },
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
          },
        },
        scales: {
          x: {
            ticks: {
              color: theme.textColor,
              font: { size: 10, family: 'Inter' },
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: theme.textColor,
              font: { size: 10, family: 'Inter' },
              callback: val => val + '%',
            },
            grid: { color: theme.gridColor },
          },
        },
      },
    });
  }
};

window.ChartManager = ChartManager;
