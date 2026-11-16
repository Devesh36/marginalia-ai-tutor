import type { BoardElement, LessonEnvelope } from './lesson';
const e = (
  id: string,
  type: BoardElement['type'],
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: BoardElement['color'] = 'ink',
): BoardElement => ({ id, type, x, y, w, h, label, color });

/** An explicitly labeled authored example, never returned by the AI API. */
export const sample: LessonEnvelope = {
  provider: 'sample',
  createdAt: '2026-11-16T00:00:00.000Z',
  lesson: {
    title: 'How does a neural network learn?',
    summary:
      'Follow a tiny network from its first prediction to a better guess. No equations required.',
    scenes: [
      {
        title: 'A network is a chain of small decisions',
        elements: [
          e('input', 'box', 65, 180, 185, 100, 'Input\nStudy hours', 'blue'),
          e('a', 'arrow', 265, 230, 100, 0, '', 'blue'),
          e('neuron', 'ellipse', 380, 155, 170, 150, 'A tiny\ncalculation', 'green'),
          e('b', 'arrow', 565, 230, 100, 0, '', 'green'),
          e('output', 'box', 680, 180, 180, 100, 'Prediction\nExam score', 'orange'),
          e('caption', 'text', 230, 370, 480, 55, 'Learn a pattern from examples', 'green'),
        ],
        beats: [
          {
            narration:
              'Imagine predicting an exam score from hours spent studying. A neural network learns a pattern from examples, rather than following a rule we write by hand.',
            reveal: ['input'],
            focus: ['input'],
          },
          {
            narration:
              'Our tiny network takes the input and passes it through a calculation. Larger networks connect many such calculations in layers.',
            reveal: ['a', 'neuron'],
            focus: ['neuron'],
          },
          {
            narration:
              'The result is a prediction. At first it can be quite wrong, because the network has not yet learned useful settings.',
            reveal: ['b', 'output', 'caption'],
            focus: ['output'],
          },
        ],
      },
      {
        title: 'Weights control the influence of each input',
        elements: [
          e('input', 'box', 60, 170, 180, 100, '3 study hours', 'blue'),
          e('a', 'arrow', 255, 220, 100, 0, '', 'blue'),
          e('weight', 'box', 370, 160, 200, 120, 'Weight = 10\nBias = 20', 'green'),
          e('b', 'arrow', 585, 220, 90, 0, '', 'green'),
          e('prediction', 'box', 690, 170, 175, 100, '50 points', 'orange'),
          e('equation', 'text', 210, 360, 520, 70, '3 × 10 + 20 = 50', 'ink'),
        ],
        beats: [
          {
            narration:
              'A weight controls how much an input matters. A bias shifts the result. These are adjustable numbers, not facts about intelligence.',
            reveal: ['input', 'a', 'weight'],
            focus: ['weight'],
          },
          {
            narration:
              'For a simple example, multiply three study hours by a weight of ten, then add a bias of twenty. The prediction is fifty.',
            reveal: ['b', 'prediction', 'equation'],
            focus: ['equation'],
          },
          {
            narration:
              'Real networks also use nonlinear operations. Those let connected layers represent patterns that a single straight-line rule cannot capture.',
            reveal: [],
            focus: ['weight'],
          },
        ],
      },
      {
        title: 'Compare the prediction with the real answer',
        elements: [
          e('guess', 'box', 120, 100, 240, 100, 'Prediction: 50', 'orange'),
          e('truth', 'box', 550, 100, 240, 100, 'Actual score: 70', 'blue'),
          e('a', 'arrow', 240, 220, 160, 100, '', 'orange'),
          e('b', 'arrow', 670, 220, -160, 100, '', 'blue'),
          e('loss', 'box', 330, 330, 270, 100, 'Error: 20 points', 'purple'),
        ],
        beats: [
          {
            narration:
              'Training examples include the real answer. Suppose this student scored seventy. We compare that with our prediction of fifty.',
            reveal: ['guess', 'truth'],
            focus: ['guess', 'truth'],
          },
          {
            narration:
              'A loss function measures how wrong the prediction is. Here the gap is twenty points; squared error would be four hundred.',
            reveal: ['a', 'b', 'loss'],
            focus: ['loss'],
          },
          {
            narration:
              'The loss gives training a goal: find settings that reduce error across many examples, not just one student.',
            reveal: [],
            focus: ['loss'],
          },
        ],
      },
      {
        title: 'Small updates, repeated many times',
        elements: [
          e('predict', 'box', 80, 110, 190, 95, '1. Predict', 'blue'),
          e('a', 'arrow', 285, 155, 110, 0, '', 'blue'),
          e('compare', 'box', 410, 110, 190, 95, '2. Measure loss', 'purple'),
          e('b', 'arrow', 615, 155, 90, 0, '', 'purple'),
          e('adjust', 'box', 720, 110, 175, 95, '3. Adjust', 'green'),
          e('return', 'arrow', 810, 245, -615, 100, 'Repeat', 'green'),
          e('test', 'box', 235, 375, 450, 75, 'Check on new, unseen examples', 'orange'),
        ],
        beats: [
          {
            narration:
              'Backpropagation computes how each setting influences the loss. An optimizer uses those gradients to make small adjustments in a helpful direction.',
            reveal: ['predict', 'a', 'compare', 'b', 'adjust'],
            focus: ['adjust'],
          },
          {
            narration:
              'Repeat: predict, measure, adjust. A learning rate controls the update size. Steps that are too large can overshoot good settings.',
            reveal: ['return'],
            focus: ['return'],
          },
          {
            narration:
              'Finally, test on unseen examples. Memorizing training answers is not enough. Learning is useful when the pattern generalizes to something new.',
            reveal: ['test'],
            focus: ['test'],
          },
        ],
      },
    ],
    quiz: {
      question: 'Why test a trained network on examples it has never seen?',
      choices: [
        'To check whether it learned a useful general pattern',
        'To make its training error exactly zero',
        'To remove all of its weights',
      ],
      answer: 0,
      explanation:
        'Unseen examples test generalization. A network can memorize training answers and still perform poorly on new inputs.',
    },
  },
};
