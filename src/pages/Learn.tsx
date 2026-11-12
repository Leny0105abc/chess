import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, Clock3, GraduationCap, Lightbulb } from 'lucide-react'
import Board from '../components/Board'
import Replay from '../components/Replay'
import { Empty, Heading, Meter } from '../components/ui'
import { endgames, lessons, type Lesson } from '../data/courses'
import { puzzles, puzzleExplanation } from '../data/puzzles'
import { colorName, line, pieceNames, play, uci, type InputMove } from '../chess'
import { levels, useProgress } from '../progress'
import { client } from '../supabase'
import endgameTablebase from '../data/endgame-tablebase.json'

function usePassingScore() {
  const [passing,setPassing]=useState(80)
  useEffect(()=>{
    let active=true
    if(client)void client.from('academy_settings').select('quiz_passing_score').eq('singleton',true).maybeSingle().then(({data})=>{if(active&&typeof data?.quiz_passing_score==='number')setPassing(data.quiz_passing_score)})
    return ()=>{active=false}
  },[])
  return passing
}

export function lessonPosition(lesson:Lesson) {
  if(lesson.moves.length)return {fen:lesson.fen,moves:lesson.moves,summary:lesson.objective}
  const pool=puzzles.filter(p=>p.themes.includes(lesson.theme==='doubleAttack'?'fork':lesson.theme??'advantage'))
  const exercise=pool.find(p=>lesson.level==='Advanced'?p.rating>=1800:p.rating>=1250)??pool[0]
  if(!exercise)throw new Error('Missing exercise for '+lesson.title)
  return {fen:exercise.fen,moves:exercise.moves,summary:puzzleExplanation(exercise)}
}
export default function Learn({section}:{section:'learn'|'endgames'|'quizzes'}) {
  const location=useLocation()
  const {profile,events}=useProgress()
  const [params,setParams]=useSearchParams()
  const filter=levels.find(level=>level===params.get('level'))??profile.level
  const [query,setQuery]=useState('')
  const library=section==='endgames'?endgames:lessons
  const item=library.find(l=>l.id===location.pathname.split('/')[2])
  const title=section==='endgames'?'Endgame Academy':section==='quizzes'?'Chess Quizzes':'Learn Chess'
  const description=section==='endgames'?'Turn an advantage into a win and learn how to hold difficult positions.':section==='quizzes'?'Test your understanding, review your answers, and track your scores.':'From your first move to advanced chess strategy.'
  if(section==='quizzes'&&(item||location.pathname.endsWith('/assessment')))return <Assessment key={location.pathname} lesson={item}/>
  if(item)return <LessonView key={item.id} lesson={item} endgame={section==='endgames'}/>
  if(location.pathname.split('/')[2])return <Empty>That lesson could not be found. <Link className="button secondary" to={'/'+section}>Back to {title}</Link></Empty>
  const visible=library.filter(l=>(query||l.level===filter)&&l.title.toLowerCase().includes(query.toLowerCase()))
  const complete=library.filter(l=>l.level===filter&&events.some(e=>e.key===(section==='endgames'?'endgame':section==='quizzes'?'quiz':'lesson')+':'+l.id)).length
  return <><Heading title={title} description={description}>{section==='quizzes'&&<Link className="button primary" to="/quizzes/assessment">Placement assessment <ArrowRight size={16}/></Link>}</Heading>
    <div className="tabs" aria-label="Skill level">{levels.map(level=><button key={level} className={'tab '+(level===filter?'active':'')} onClick={()=>{setQuery('');setParams({level})}}>{level}</button>)}{section==='quizzes'&&<Link className="tab" to={'/quizzes/assessment?level='+filter}>{filter} assessment</Link>}</div>
    <div className="card panel course-banner"><div className="between"><div><h2>{filter} {section==='endgames'?'endgames':section==='quizzes'?'quizzes':'course'}</h2><p>{complete} of {library.filter(l=>l.level===filter).length} completed</p></div><GraduationCap size={30}/></div><Meter value={100*complete/library.filter(l=>l.level===filter).length} label="Course completion"/></div>
    <div className="filter-bar"><input aria-label="Search lessons" placeholder="Search by title" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {visible.length?<div className="grid-list">{visible.map(l=><article key={l.id} className="card list-card">
      <div className="between" style={{width:'100%'}}><div className="tile-icon green"><BookOpen size={19}/></div>{events.some(e=>e.key===(section==='endgames'?'endgame':section==='quizzes'?'quiz':'lesson')+':'+l.id)?<span className="tag"><Check size={12}/> Complete</span>:<span className="tag">{l.level}</span>}</div>
      <h2>{l.title}</h2><p>{l.objective}</p><span className="muted small wrap"><Clock3 size={13}/> {l.minutes} min</span>
      <Link className="button secondary" to={'/'+section+'/'+l.id}>{section==='quizzes'?'Take quiz':'Open lesson'} <ArrowRight size={15}/></Link>
    </article>)}</div>:<Empty>No lessons match your search.</Empty>}
  </>
}

function LessonView({lesson,endgame}:{lesson:Lesson;endgame:boolean}) {
  const {add,events}=useProgress()
  const passing=usePassingScore()
  const solvedPosition=endgameTablebase[lesson.id as keyof typeof endgameTablebase]
  const [tab,setTab]=useState('Demonstration')
  const [step,setStep]=useState(0)
  const [feedback,setFeedback]=useState('')
  const [hint,setHint]=useState(false)
  const [passed,setPassed]=useState(false)
  const [practiceDone,setPracticeDone]=useState(false)
  const [round,setRound]=useState(0)
  const position=useMemo(()=>lessonPosition(lesson),[lesson])
  const game=line(position.fen,position.moves.slice(0,step)).game
  const history=useMemo(()=>line(position.fen,position.moves).history,[position])
  const current=history[step]
  const target=history[0]
  const kind=endgame?'endgame':'lesson'
  const done=events.some(e=>e.key===kind+':'+lesson.id)
  const isPositionLesson=lesson.id==='chessboard-coordinates'||lesson.id==='understanding-the-chessboard'
  function makeMove(move:InputMove) {
    if(!current||practiceDone)return
    const played=play(game,move)
    if(uci(played)!==uci(current)&&!(current.san.endsWith('#')&&game.isCheckmate())) {
      setFeedback('That move is legal. Try '+(lesson.moves.length?'the continuation from the demonstration.':'a more forcing continuation.'))
      return
    }
    const next=lesson.moves.length&&!endgame?history.length:Math.min(history.length,step+2)
    setStep(next)
    if(next===history.length){setPracticeDone(true);setFeedback('Exercise complete. Review the quiz to finish the lesson.')}
    else setFeedback('Correct. The opponent’s reply is on the board.')
  }
  const next=(endgame?endgames:lessons).find(l=>l.level===lesson.level&&l.index===lesson.index+1)
  return <><Heading title={lesson.title} description={lesson.level+' · '+lesson.minutes+' min'} back={{to:endgame?'/endgames':'/learn',label:endgame?'Endgame Academy':'Learn Chess'}}>{done&&<span className="tag"><Check size={14}/> Completed</span>}</Heading>
    <div className="card panel lesson-intro"><div className="subtle-label">Learning objective</div><h2>{lesson.objective}</h2><p>{lesson.explanation}</p>{endgame&&solvedPosition&&<span className="tag">Tablebase · {solvedPosition.category} for the side to move</span>}</div>
    <div className="tabs" aria-label="Lesson sections">{['Demonstration','Guided practice','Quiz'].map(name=><button className={'tab '+(tab===name?'active':'')} onClick={()=>setTab(name)} key={name}>{name}{name==='Guided practice'&&practiceDone?' ✓':''}</button>)}</div>
    {tab==='Demonstration'&&<Replay fen={position.fen} moves={position.moves} summary={position.summary} extra={<button className="button primary" onClick={()=>setTab('Guided practice')}>Start guided practice <ArrowRight size={15}/></button>}/>}
    {tab==='Guided practice'&&<div className="studio-grid"><div className="studio-board"><Board fen={game.fen()} onMove={!practiceDone&&!isPositionLesson?makeMove:undefined} onSquare={isPositionLesson&&!practiceDone?square=>{if(square===(lesson.id==='chessboard-coordinates'?'e4':'h1')){setPracticeDone(true);setFeedback('Correct square.')}else setFeedback('Try another square. Read the file letter first.')} :undefined} arrows={hint&&current&&!isPositionLesson?[{from:current.from,to:current.to}]:[]}/></div><div className="card studio-panel">
      <div className="subtle-label">{colorName(game.turn())} to move</div><h2>Apply the lesson</h2>
      <p>{isPositionLesson?'Select '+(lesson.id==='chessboard-coordinates'?'e4':'the light square in White’s near-right corner')+'.':lesson.moves.length?(endgame?'Play the next move from the demonstration.':'Play the first move from the demonstration.'):'Find the tactic and follow through after the opponent replies.'}</p>
      {feedback&&<div className="notice-box" role="status">{feedback}</div>}
      <div className="wrap"><button className="button secondary" disabled={practiceDone} onClick={()=>setHint(!hint)}><Lightbulb size={15}/> {hint?'Hide hint':'Hint'}</button><button className="button secondary" onClick={()=>{setStep(0);setHint(false);setPracticeDone(false);setFeedback('')}}>Retry</button>{endgame&&<Link className="button secondary" to={'/play?fen='+encodeURIComponent(position.fen)+(position.fen.split(' ')[1]==='b'?'&color=Black':'')}>Play vs Computer</Link>}{lesson.level==='Advanced'&&<Link className="text-button" to={'/analysis?fen='+encodeURIComponent(game.fen())}>Analyze position <ArrowRight size={14}/></Link>}</div>
      {hint&&target&&<p>{isPositionLesson?'The bottom rank is rank 1.':current?'Look at '+current.from+' and '+current.to+'.':''}</p>}
      {practiceDone&&<button className="button primary" onClick={()=>setTab('Quiz')}>Take lesson quiz <ArrowRight size={15}/></button>}
    </div></div>}
    {tab==='Quiz'&&<div className="card panel quiz-panel"><Quiz key={round} questions={questionsFor(lesson)} onFinish={score=>{setPassed(score>=passing);if(score>=passing)add('quiz',lesson.id,lesson.title+' quiz',score)}}/>
      <div className="wrap"><button className="button secondary" onClick={()=>{setRound(round+1);setPassed(false)}}>Retry quiz</button>
        <button className="button primary" disabled={!passed||!practiceDone||done} onClick={()=>add(kind,lesson.id,lesson.title)}>Complete lesson</button>
        {done&&next&&<Link className="button primary" to={(endgame?'/endgames/':'/learn/')+next.id}>Next lesson <ArrowRight size={15}/></Link>}</div>
      <p>{done?'Lesson saved to your progress.':!practiceDone?'Finish guided practice to complete the lesson.':'Score at least '+passing+'% to complete the lesson.'}</p>
    </div>}
    <div className="card panel lesson-summary"><h2>Lesson summary</h2><p>{lesson.explanation}</p>{endgame&&solvedPosition&&<span className="tag">Tablebase · {solvedPosition.category} for the side to move</span>}</div>
  </>
}
type Question={prompt:string;answer:string;wrong?:string;reason:string;fen?:string;task?:'square'|'move'}
function questionsFor(l:Lesson):Question[]{
  const pos=lessonPosition(l)
  const first=line(pos.fen,pos.moves).history[0]
  const check=/[+#]$/.test(first.san)
  const piece=pieceNames[first.piece]
  return [
    {prompt:l.question,answer:l.answer,wrong:l.wrong,reason:l.explanation},
    {prompt:'Select '+first.to+' on the board.',answer:first.to,task:'square',fen:pos.fen,reason:first.to+' is on file '+first.to[0]+' and rank '+first.to[1]+'.'},
    {prompt:'Which piece plays '+first.san+' in this line?',answer:piece,wrong:piece==='pawn'?'knight':'pawn',reason:'The '+piece+' moves from '+first.from+' to '+first.to+'.'},
    {prompt:'True or false: '+first.san+' gives check.',answer:check?'True':'False',wrong:check?'False':'True',reason:check?'The move attacks the king. The + or # in SAN shows this.':'The move does not attack the king. SAN uses + for check and # for checkmate.'},
    {prompt:'Play the recorded first move for '+colorName(first.color)+'.',answer:first.san,task:'move',fen:pos.fen,reason:'The demonstration begins with '+first.san+'.'}
  ]
}
function Quiz({questions,onFinish}:{questions:Question[];onFinish:(score:number)=>void}){
  const [order]=useState(()=>{
    const items=questions.map(q=>({...q,options:q.wrong?(Math.random()<.5?[q.answer,q.wrong]:[q.wrong,q.answer]):[]}))
    for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}
    return items
  })
  const [answers,setAnswers]=useState<string[]>([])
  const [review,setReview]=useState(false)
  const [started]=useState(Date.now)
  const i=answers.length
  const question=order[i]
  const correct=answers.filter((value,index)=>value===order[index].answer).length
  const score=Math.round(correct/order.length*100)
  function answer(option:string){
    const next=[...answers,option];setAnswers(next)
    if(next.length===order.length)onFinish(Math.round(next.filter((value,index)=>value===order[index].answer).length/order.length*100))
  }
  if(!question)return <><h2>Score {score}%</h2><Meter value={score} label="Quiz score"/><p>{correct} of {order.length} correct · {Math.round((Date.now()-started)/1000)} seconds</p><button className="button secondary" onClick={()=>setReview(!review)}>{review?'Hide review':'Review answers'}</button>{review&&order.map((q,j)=><div className="notice-box" key={j}><strong>{q.prompt}</strong><p>Your answer was {answers[j]}. {q.reason}</p></div>)}</>
  const game=question.fen?line(question.fen,[]).game:undefined
  return <><div className="subtle-label">Question {i+1} of {order.length}</div><h2>{question.prompt}</h2>{game?<div className="quiz-board"><Board key={i} fen={game.fen()} flipped={question.task==='move'&&game.turn()==='b'} onSquare={question.task==='square'?answer:undefined} onMove={question.task==='move'?move=>{const made=play(game,move);answer(question.answer.endsWith('#')&&game.isCheckmate()?question.answer:made.san)}:undefined}/></div>:<div className="wrap">{question.options.map(option=><button className="button secondary" key={option} onClick={()=>answer(option)}>{option}</button>)}</div>}
    {i>0&&<p aria-live="polite">{answers[i-1]===order[i-1].answer?'Correct. ':'Incorrect. '}{order[i-1].reason}</p>}
  </>
}
function Assessment({lesson}:{lesson?:Lesson}){
  const {add,update}=useProgress()
  const passing=usePassingScore()
  const [params]=useSearchParams()
  const tier=levels.find(level=>level===params.get('level'))
  const [attempt,setAttempt]=useState(0)
  const [score,setScore]=useState<number>()
  const qs=lesson?questionsFor(lesson):tier?lessons.filter(l=>l.level===tier&&l.index%2===1).map(l=>questionsFor(l)[0]):[lessons[8],lessons[12],lessons[16],lessons[25],lessons[40],lessons[56],lessons[67],lessons[73]].map(l=>questionsFor(l)[0])
  const recommended=score===undefined?undefined:score>=88?'Advanced':score>=63?'Intermediate':'Beginner'
  return <><Heading title={lesson?lesson.title+' quiz':tier?tier+' assessment':'Placement assessment'} back={{to:'/quizzes',label:'Chess Quizzes'}}/>
    <div className="card panel quiz-panel"><Quiz key={attempt+String(tier)} questions={qs} onFinish={result=>{setScore(result);if(lesson&&result>=passing)add('quiz',lesson.id,lesson.title+' quiz',result);if(tier&&result>=passing)add('quiz','assessment-'+tier,tier+' assessment',result)}}/>
      {score!==undefined&&<div className="wrap"><button className="button secondary" onClick={()=>{setAttempt(attempt+1);setScore(undefined)}}>Retry quiz</button>{!lesson&&!tier&&recommended&&<button className="button primary" onClick={()=>update({level:recommended})}>Set learning path to {recommended}</button>}</div>}
    </div>
  </>
}
