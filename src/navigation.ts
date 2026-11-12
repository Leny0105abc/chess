import { LayoutDashboard, GraduationCap, BookOpen, Target, Bot, ChartNoAxesCombined, Flag, ClipboardList, CalendarDays, Trophy, TrendingUp, LibraryBig, Settings, Users, Shield } from 'lucide-react'

export const sections=[
  {label:'Overview', links:[{name:'Dashboard',path:'/',icon:LayoutDashboard}]},
  {label:'Academy', links:[
    {name:'Learn Chess',path:'/learn',icon:GraduationCap},
    {name:'Chess Openings',path:'/openings',icon:BookOpen},
    {name:'Puzzle Arena',path:'/puzzles',icon:Target},
    {name:'Play vs Computer',path:'/play',icon:Bot},
    {name:'Game Analysis',path:'/analysis',icon:ChartNoAxesCombined},
    {name:'Endgame Academy',path:'/endgames',icon:Flag},
    {name:'Chess Quizzes',path:'/quizzes',icon:ClipboardList}
  ]},
  {label:'Your activity', links:[
    {name:'Daily Challenge',path:'/daily',icon:CalendarDays},
    {name:'Leaderboard',path:'/leaderboard',icon:Trophy},
    {name:'My Progress',path:'/progress',icon:TrendingUp},
    {name:'Chess Resources',path:'/resources',icon:LibraryBig}
  ]}
]
export const settings={name:'Settings',path:'/settings',icon:Settings}
export const classroom={name:'Classroom',path:'/classroom',icon:Users}
export const admin={name:'Administration',path:'/admin',icon:Shield}
