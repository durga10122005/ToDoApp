/**
 * Natural Language Parser for Quick Capture
 * Extracts: title, dueDate, priority, project, and tags
 */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseNaturalLanguage(input, availableProjects = []) {
  if (!input || !input.trim()) {
    return {
      cleanTitle: '',
      dueDate: null,
      priority: 'p4',
      projectId: null,
      tags: [],
      chips: []
    };
  }

  let text = input.trim();
  const chips = [];
  let dueDate = null;
  let priority = 'p4';
  let projectId = null;
  const tags = [];

  // 1. Extract Priority: !p1, !p2, !p3, !p4, !urgent, !high, !med, !low
  const priorityRegex = /(?:^|\s)!([pP][1-4]|urgent|high|med|medium|low)\b/i;
  const pMatch = text.match(priorityRegex);
  if (pMatch) {
    const pVal = pMatch[1].toLowerCase();
    if (pVal === 'p1' || pVal === 'urgent') priority = 'p1';
    else if (pVal === 'p2' || pVal === 'high') priority = 'p2';
    else if (pVal === 'p3' || pVal === 'med' || pVal === 'medium') priority = 'p3';
    else priority = 'p4';

    chips.push({ type: 'priority', label: priority.toUpperCase(), value: priority });
    text = text.replace(priorityRegex, ' ');
  }

  // 2. Extract Tags: @frontend, @ux, @bug
  const tagRegex = /(?:^|\s)@([a-zA-Z0-9_\-]+)\b/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(text)) !== null) {
    const tag = tagMatch[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
      chips.push({ type: 'tag', label: `@${tag}`, value: tag });
    }
  }
  text = text.replace(tagRegex, ' ');

  // 3. Extract Project: #Work, #Design, #Engineering
  const projectRegex = /(?:^|\s)#([a-zA-Z0-9_\-]+)\b/i;
  const projMatch = text.match(projectRegex);
  if (projMatch) {
    const rawProj = projMatch[1].toLowerCase();
    const matchedProject = availableProjects.find(
      p => p.name.toLowerCase().replace(/\s+/g, '') === rawProj || p.name.toLowerCase().includes(rawProj)
    );
    if (matchedProject) {
      projectId = matchedProject.id;
      chips.push({ type: 'project', label: `#${matchedProject.name}`, value: matchedProject.id });
    } else {
      chips.push({ type: 'project', label: `#${projMatch[1]}`, value: null });
    }
    text = text.replace(projectRegex, ' ');
  }

  // 4. Extract Due Date & Time
  const now = new Date();
  let targetDate = null;
  let dateLabel = '';

  // Time extraction helper (e.g., 3pm, 3:30pm, 14:00, 10am)
  let targetHour = 12;
  let targetMinute = 0;
  let hasSpecificTime = false;

  const timeRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  // Look for relative date keywords
  const lower = text.toLowerCase();

  // "in X days" or "in X weeks"
  const inDaysMatch = lower.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/i);
  if (inDaysMatch) {
    const count = parseInt(inDaysMatch[1], 10);
    const unit = inDaysMatch[2].toLowerCase();
    const daysToAdd = unit.startsWith('week') ? count * 7 : count;
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    dateLabel = `In ${count} ${unit}`;
    text = text.replace(inDaysMatch[0], ' ');
  } else if (/\btomorrow\b/i.test(text)) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    dateLabel = 'Tomorrow';
    text = text.replace(/\btomorrow\b/i, ' ');
  } else if (/\btoday\b/i.test(text)) {
    targetDate = new Date();
    dateLabel = 'Today';
    text = text.replace(/\btoday\b/i, ' ');
  } else if (/\btonight\b/i.test(text)) {
    targetDate = new Date();
    targetHour = 20;
    hasSpecificTime = true;
    dateLabel = 'Tonight (8:00 PM)';
    text = text.replace(/\btonight\b/i, ' ');
  } else {
    // Check next [day of week]
    for (let i = 0; i < DAYS.length; i++) {
      const dayName = DAYS[i];
      const nextDayRegex = new RegExp(`\\b(?:next\\s+)?${dayName}\\b`, 'i');
      if (nextDayRegex.test(text)) {
        targetDate = new Date();
        const currentDay = targetDate.getDay();
        let diff = i - currentDay;
        if (diff <= 0) diff += 7;
        targetDate.setDate(targetDate.getDate() + diff);
        dateLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        text = text.replace(nextDayRegex, ' ');
        break;
      }
    }
  }

  // Parse time if date detected or standalone time
  const tMatch = text.match(timeRegex);
  if (tMatch && (tMatch[3] || tMatch[2] || /\bat\s+\d+/i.test(tMatch[0]))) {
    let h = parseInt(tMatch[1], 10);
    const m = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
    const meridiem = tMatch[3] ? tMatch[3].toLowerCase() : null;

    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;

    targetHour = h;
    targetMinute = m;
    hasSpecificTime = true;
    text = text.replace(tMatch[0], ' ');

    if (!targetDate) {
      targetDate = new Date(); // assume today if only time given
      dateLabel = 'Today';
    }
    dateLabel += ` at ${String(targetHour % 12 || 12)}:${String(targetMinute).padStart(2, '0')} ${targetHour >= 12 ? 'PM' : 'AM'}`;
  }

  if (targetDate) {
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    dueDate = targetDate.toISOString();
    chips.unshift({ type: 'date', label: dateLabel || 'Due Date', value: dueDate });
  }

  // Clean trailing spaces and double spaces
  const cleanTitle = text.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle: cleanTitle || input.trim(),
    dueDate,
    priority,
    projectId,
    tags,
    chips
  };
}
