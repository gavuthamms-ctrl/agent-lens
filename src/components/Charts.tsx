import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { EvaluationTypeMetrics } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface ThemeProps {
  theme: 'dark' | 'light';
}

export const DefectsByTypeChart: React.FC<{
  typeCounts: Record<string, number>;
} & ThemeProps> = ({ typeCounts, theme }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipText = isDark ? '#ffffff' : '#0f172a';

  const labels = Object.keys(typeCounts).map(k => k.replace(/_/g, ' '));
  const data = Object.values(typeCounts);

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Defect Frequency',
            data,
            backgroundColor: 'rgba(99, 102, 241, 0.65)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: '#6366f1',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              font: { size: 10, family: 'Inter' },
              maxRotation: 45,
              minRotation: 25,
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor,
              font: { size: 11, family: 'Inter' },
              stepSize: 1,
            },
            grid: { color: gridColor },
          },
        },
      }}
    />
  );
};

export const DefectsBySeverityChart: React.FC<{
  severityCounts: Record<string, number>;
} & ThemeProps> = ({ severityCounts, theme }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipText = isDark ? '#ffffff' : '#0f172a';

  const labels = ['Critical', 'High', 'Medium', 'Low'];
  const data = [
    severityCounts.critical || 0,
    severityCounts.high || 0,
    severityCounts.medium || 0,
    severityCounts.low || 0,
  ];

  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            data,
            backgroundColor: ['#ef4444', '#f97316', '#eab308', '#0ea5e9'],
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: { size: 11, family: 'Inter' },
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
          },
        },
        cutout: '65%',
      }}
    />
  );
};

export const DefectsByAgentChart: React.FC<{
  agentCounts: Record<string, number>;
} & ThemeProps> = ({ agentCounts, theme }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipText = isDark ? '#ffffff' : '#0f172a';

  const labels = Object.keys(agentCounts);
  const data = Object.values(agentCounts);

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Defects Involved',
            data,
            backgroundColor: 'rgba(249, 115, 22, 0.65)',
            borderColor: '#f97316',
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: textColor,
              font: { size: 10, family: 'Inter' },
              stepSize: 1,
            },
            grid: { color: gridColor },
          },
          y: {
            ticks: {
              color: textColor,
              font: { size: 11, family: 'Inter' },
            },
            grid: { display: false },
          },
        },
      }}
    />
  );
};

export const EvaluationChart: React.FC<{
  perTypeMetrics: EvaluationTypeMetrics[];
} & ThemeProps> = ({ perTypeMetrics, theme }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipText = isDark ? '#ffffff' : '#0f172a';

  const active = perTypeMetrics.filter(m => m.ground_truth_count > 0 || m.detected_count > 0);
  const displayList = active.length > 0 ? active : perTypeMetrics.slice(0, 5);

  const labels = displayList.map(m => m.defect_type.replace(/_/g, ' '));
  const precisionData = displayList.map(m => Math.round(m.precision * 100));
  const recallData = displayList.map(m => Math.round(m.recall * 100));
  const f1Data = displayList.map(m => Math.round(m.f1_score * 100));

  return (
    <Bar
      data={{
        labels,
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
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { size: 11, family: 'Inter' },
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              font: { size: 10, family: 'Inter' },
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: textColor,
              font: { size: 10, family: 'Inter' },
              callback: val => val + '%',
            },
            grid: { color: gridColor },
          },
        },
      }}
    />
  );
};
