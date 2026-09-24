export const assessment = {
  code: 'A2-EXPEDITION',
  title: 'The English Expedition',
  level: 'A2',
  description: 'Diez retos para descubrir cómo te comunicas en situaciones reales.',
  minutes: 12,
};

// Content and answer keys live on the server. Only the public fields are sent to browsers.
export const questions = [
  { id: 'g1', type: 'multiple_choice', skill: 'Grammar', level: 'A2', prompt: 'Every morning, Maya ___ the train to work.', options: ['take', 'takes', 'taking', 'took'], correct: 'takes', explanation: 'Con he, she o it, el presente simple añade -s al verbo.' },
  { id: 'g2', type: 'multiple_choice', skill: 'Grammar', level: 'A2', prompt: 'We ___ dinner when the phone rang.', options: ['have', 'had', 'were having', 'are having'], correct: 'were having', explanation: 'Una acción en progreso interrumpida en el pasado usa past continuous.' },
  { id: 'g3', type: 'multiple_choice', skill: 'Grammar', level: 'A2', prompt: 'There isn’t ___ milk left in the fridge.', options: ['some', 'any', 'many', 'a'], correct: 'any', explanation: 'En oraciones negativas normalmente se usa any con sustantivos incontables.' },
  { id: 'g4', type: 'multiple_choice', skill: 'Grammar', level: 'A2', prompt: 'This book is ___ than the one I read last week.', options: ['interesting', 'more interesting', 'most interesting', 'interestinger'], correct: 'more interesting', explanation: 'El comparativo de adjetivos largos se forma con more.' },
  { id: 'g5', type: 'fill', skill: 'Grammar', level: 'A2', prompt: 'Completa con una palabra: If it rains, we ___ stay at home.', correct: 'will', explanation: 'En el primer condicional: if + presente, will + verbo base.' },
  { id: 'g6', type: 'fill', skill: 'Grammar', level: 'A2', prompt: 'Completa con una palabra: She has lived in Quito ___ 2022.', correct: 'since', explanation: 'Since indica el punto de inicio; for indica una duración.' },
  { id: 'r1', type: 'comprehension', skill: 'Reading', level: 'A2', passage: 'Leo sent a message to his friend: “The museum opens at 10 a.m. Let’s meet at the café across the street at 9:30. I already bought our tickets online.”', prompt: 'Where will Leo and his friend meet?', options: ['At the museum entrance', 'At the café across the street', 'At the train station', 'At Leo’s house'], correct: 'At the café across the street', explanation: 'Leo propone encontrarse en el café frente al museo.' },
  { id: 'r2', type: 'comprehension', skill: 'Reading', level: 'A2', passage: 'Leo sent a message to his friend: “The museum opens at 10 a.m. Let’s meet at the café across the street at 9:30. I already bought our tickets online.”', prompt: 'What did Leo do before sending the message?', options: ['He visited the museum', 'He ordered coffee', 'He bought the tickets online', 'He called the café'], correct: 'He bought the tickets online', explanation: '“I already bought our tickets online” confirma la acción previa.' },
  { id: 'v1', type: 'vocabulary', skill: 'Vocabulary', level: 'A2', prompt: 'Your train leaves in five minutes. You need to ___!', options: ['hurry', 'rest', 'forget', 'wait'], correct: 'hurry', explanation: 'Hurry significa apresurarse.' },
  { id: 'v2', type: 'vocabulary', skill: 'Vocabulary', level: 'A2', prompt: 'Which word is closest in meaning to “affordable”?', options: ['expensive', 'cheap enough', 'unavailable', 'comfortable'], correct: 'cheap enough', explanation: 'Affordable significa que tiene un precio accesible.' },
];

export function publicQuestion(q) {
  const { id, type, skill, level, prompt, options, passage } = q;
  return { id, type, skill, level, prompt, ...(options ? { options } : {}), ...(passage ? { passage } : {}) };
}
