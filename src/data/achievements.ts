import { levels, streak, type Event } from '../progress'
import { lessons } from './courses'
const kind=(events:Event[],name:string)=>events.filter(event=>event.kind===name)
const records=(events:Event[],name:string)=>events.filter(event=>event.key.startsWith('record:'+name))
export const achievements:{name:string;description:string;test:(events:Event[])=>boolean}[]=[
  {name:'First Lesson',description:'Complete a chess lesson.',test:e=>kind(e,'lesson').length>=1},
  {name:'Opening Explorer',description:'Complete one opening practice session.',test:e=>kind(e,'opening').length>=1},
  {name:'Puzzle Solver',description:'Solve a tactical puzzle.',test:e=>kind(e,'puzzle').length>=1},
  {name:'First Checkmate',description:'Win a game against the computer by checkmate.',test:e=>kind(e,'game').length>=1},
  {name:'Tactical Genius',description:'Solve 50 distinct puzzles.',test:e=>kind(e,'puzzle').length>=50},
  {name:'Endgame Specialist',description:'Complete 10 endgame exercises.',test:e=>kind(e,'endgame').length>=10},
  {name:'7-Day Streak',description:'Train on seven consecutive days.',test:e=>streak(e)>=7},
  {name:'30-Day Streak',description:'Train on thirty consecutive days.',test:e=>streak(e)>=30},
  {name:'Opening Master',description:'Score at least 95% in five opening variations.',test:e=>kind(e,'opening').filter(x=>x.score>=95).length>=5},
  {name:'100 Puzzles Solved',description:'Solve 100 distinct puzzles.',test:e=>kind(e,'puzzle').length>=100},
  {name:'500 Puzzles Solved',description:'Solve 500 distinct puzzles as the library expands.',test:e=>kind(e,'puzzle').length>=500},
  {name:'Perfect Quiz',description:'Answer every question in a quiz correctly.',test:e=>kind(e,'quiz').some(x=>x.score===100)},
  {name:'Level Completion',description:'Complete all 25 lessons in any course.',test:events=>{
    const completed=new Set(kind(events,'lesson').map(event=>event.key))
    return levels.some(level=>lessons.filter(lesson=>lesson.level===level).every(lesson=>completed.has('lesson:'+lesson.id)))
  }},
  {name:'Daily Debut',description:'Solve one daily challenge.',test:e=>kind(e,'daily').length>=1},
  {name:'Daily Regular',description:'Solve ten different daily challenges.',test:e=>kind(e,'daily').length>=10},
  {name:'Fast Calculation',description:'Solve five puzzles in a Puzzle Rush session.',test:e=>records(e,'rush').some(x=>x.score>=5)},
  {name:'Survivor',description:'Solve five puzzles in a Survival session.',test:e=>records(e,'survival').some(x=>x.score>=5)},
  {name:'Adventure Begins',description:'Complete the first five-puzzle adventure stage.',test:e=>records(e,'adventure').some(x=>x.score>=5)},
  {name:'Quiz Scholar',description:'Pass ten distinct quizzes.',test:e=>kind(e,'quiz').length>=10},
  {name:'Endgame Graduate',description:'Complete all 21 endgame exercises.',test:e=>kind(e,'endgame').length>=21},
  {name:'Academy Graduate',description:'Complete all 75 core lessons.',test:e=>kind(e,'lesson').length>=75}
]
