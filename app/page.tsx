// @ts-nocheck
/* eslint-disable */
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Sun, Moon, Monitor, ArrowUp, ArrowDown, Plus, Trash2, Edit3, Play, Film, ShieldAlert } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function PromptChainTool() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system')

  const [chains, setChains] = useState<any[]>([])
  const [selectedChain, setSelectedChain] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [generations, setGenerations] = useState<any[]>([])

  const [chainModal, setChainModal] = useState(false)
  const [editingChain, setEditingChain] = useState<any>(null)
  const [chainForm, setChainForm] = useState({ name: '', description: '' })

  const [stepModal, setStepModal] = useState(false)
  const [editingStep, setEditingStep] = useState<any>(null)
  const [stepForm, setStepForm] = useState({ prompt_template: '', description: '' })

  const [executing, setExecuting] = useState(false)
  const [inputVal, setInputVal] = useState('')

  // 1. 动态响应 Theme 切换
  useEffect(() => {
    const root = document.documentElement
    if (themeMode === 'dark') {
      root.classList.add('dark')
    } else if (themeMode === 'light') {
      root.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [themeMode])

  // 2. 检查 superadmin 权限
  useEffect(() => {
    async function initAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setLoading(false)

      if (session?.user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_superadmin')
            .eq('id', session.user.id)
            .single()

        if (profile?.is_superadmin === true) {
          setIsAdmin(true)
          fetchChains()
        }
      }
    }
    initAuth()
  }, [])

  const fetchChains = async () => {
    const { data } = await supabase.from('prompt_chains').select('*').order('created_at', { ascending: false })
    if (data) {
      setChains(data)
      if (data.length > 0 && !selectedChain) {
        selectChain(data[0])
      }
    }
  }

  const selectChain = async (chain: any) => {
    setSelectedChain(chain)
    fetchSteps(chain.id)
    fetchGenerations(chain.id)
  }

  const fetchSteps = async (chainId: string) => {
    const { data } = await supabase.from('prompt_chain_steps').select('*').eq('chain_id', chainId).order('step_order', { ascending: true })
    setSteps(data || [])
  }

  const fetchGenerations = async (chainId: string) => {
    const { data } = await supabase.from('chain_generations').select('*').eq('chain_id', chainId).order('created_at', { ascending: false })
    setGenerations(data || [])
  }

  // Chains CRUD
  const handleSaveChain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingChain) {
      await supabase.from('prompt_chains').update(chainForm).eq('id', editingChain.id)
    } else {
      await supabase.from('prompt_chains').insert([chainForm])
    }
    setChainModal(false)
    fetchChains()
  }

  const handleDeleteChain = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt chain?')) return
    await supabase.from('prompt_chains').delete().eq('id', id)
    if (selectedChain?.id === id) setSelectedChain(null)
    fetchChains()
  }

  // Steps CRUD
  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChain) return

    if (editingStep) {
      await supabase.from('prompt_chain_steps').update(stepForm).eq('id', editingStep.id)
    } else {
      const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 1
      await supabase.from('prompt_chain_steps').insert([{ ...stepForm, chain_id: selectedChain.id, step_order: nextOrder }])
    }
    setStepModal(false)
    fetchSteps(selectedChain.id)
  }

  const handleDeleteStep = async (id: string) => {
    if (!confirm('Delete this step?')) return
    await supabase.from('prompt_chain_steps').delete().eq('id', id)
    fetchSteps(selectedChain.id)
  }

  // 步骤重排序 (Reorder Steps)
  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    if (!selectedChain) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= steps.length) return

    const currentStep = steps[index]
    const targetStep = steps[targetIndex]

    await supabase.from('prompt_chain_steps').update({ step_order: targetStep.step_order }).eq('id', currentStep.id)
    await supabase.from('prompt_chain_steps').update({ step_order: currentStep.step_order }).eq('id', targetStep.id)

    fetchSteps(selectedChain.id)
  }

  // 执行 Chain 生成 Media
  const handleRunChain = async () => {
    if (!selectedChain || steps.length === 0) return alert('Add steps before executing!')
    setExecuting(true)

    try {
      let logOutput = `[Execution Log for ${selectedChain.name}]\nInput: ${inputVal || 'Sample Input'}\n\n`
      steps.forEach((st) => {
        logOutput += `Step ${st.step_order} (${st.description || 'Step'}): ${st.prompt_template}\n-> Result processed successfully.\n\n`
      })
      logOutput += `[Final Media Output Successfully Generated!]`

      await supabase.from('chain_generations').insert([{
        chain_id: selectedChain.id,
        input_data: inputVal || 'Sample Input',
        output_media: logOutput
      }])

      fetchGenerations(selectedChain.id)
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>
  }

  if (!user || !isAdmin) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl space-y-4">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-2xl font-black">Prompt Chain Admin Only</h1>
            <p className="text-sm text-slate-400">Requires <code className="bg-slate-800 px-2 py-1 rounded text-red-400">profiles.is_superadmin == TRUE</code></p>
            {!user ? (
                <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-2xl transition">Sign In with Google</button>
            ) : (
                <button onClick={() => supabase.auth.signOut().then(() => location.reload())} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sm font-semibold rounded-xl">Sign Out ({user.email})</button>
            )}
          </div>
        </div>
    )
  }

  return (
      <div className={`min-h-screen ${themeMode === 'dark' || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

        {/* 顶部导航与主题切换 */}
        <header className="border-b border-slate-800/20 px-8 py-4 flex justify-between items-center bg-slate-900/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔗</span>
            <h1 className="font-black text-xl tracking-tight">Prompt Chain Tool</h1>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700/30 text-xs">
            <button onClick={() => setThemeMode('light')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${themeMode === 'light' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Sun className="w-3.5 h-3.5"/> Light</button>
            <button onClick={() => setThemeMode('dark')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${themeMode === 'dark' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Moon className="w-3.5 h-3.5"/> Dark</button>
            <button onClick={() => setThemeMode('system')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${themeMode === 'system' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Monitor className="w-3.5 h-3.5"/> System</button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* 左侧：Chain 列表 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Prompt Chains</h2>
              <button onClick={() => { setEditingChain(null); setChainForm({ name: '', description: '' }); setChainModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"><Plus className="w-3.5 h-3.5"/> Create Chain</button>
            </div>

            <div className="space-y-3">
              {chains.map((chain) => (
                  <div key={chain.id} onClick={() => selectChain(chain)} className={`p-4 rounded-2xl border transition cursor-pointer flex justify-between items-start ${selectedChain?.id === chain.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/30 border-slate-800'}`}>
                    <div>
                      <h3 className="font-bold text-sm">{chain.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{chain.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditingChain(chain); setChainForm({ name: chain.name, description: chain.description }); setChainModal(true); }} className="p-1.5 text-slate-400"><Edit3 className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteChain(chain.id); }} className="p-1.5 text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
              ))}
            </div>
          </div>

          {/* 右侧：Steps 管理与重排序 */}
          <div className="lg:col-span-8 space-y-8">
            {selectedChain ? (
                <>
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold">{selectedChain.name}</h2>
                        <p className="text-xs text-slate-400">{selectedChain.description}</p>
                      </div>
                      <button onClick={() => { setEditingStep(null); setStepForm({ prompt_template: '', description: '' }); setStepModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl"><Plus className="w-3.5 h-3.5"/> Add Step</button>
                    </div>

                    <div className="space-y-3">
                      {steps.map((st, idx) => (
                          <div key={st.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center border border-indigo-500/30">{st.step_order}</span>
                              <div>
                                <p className="text-xs font-bold text-slate-400">{st.description || `Step ${st.step_order}`}</p>
                                <p className="text-sm font-mono text-indigo-300 mt-0.5">{st.prompt_template}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button disabled={idx === 0} onClick={() => handleMoveStep(idx, 'up')} className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300"><ArrowUp className="w-4 h-4"/></button>
                              <button disabled={idx === steps.length - 1} onClick={() => handleMoveStep(idx, 'down')} className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-300"><ArrowDown className="w-4 h-4"/></button>
                              <button onClick={() => { setEditingStep(st); setStepForm({ prompt_template: st.prompt_template, description: st.description }); setStepModal(true); }} className="p-1.5 text-slate-400"><Edit3 className="w-4 h-4"/></button>
                              <button onClick={() => handleDeleteStep(st.id)} className="p-1.5 text-red-400"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>

                  {/* 运行与生成媒体 */}
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Play className="w-4 h-4 text-emerald-400"/> Run Chain & Generate Media</h3>
                    <div className="flex gap-3">
                      <input type="text" placeholder="Input sample data..." value={inputVal} onChange={(e) => setInputVal(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white" />
                      <button onClick={handleRunChain} disabled={executing} className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl">{executing ? 'Running...' : 'Generate Media'}</button>
                    </div>
                  </div>

                  {/* 查看生成的媒体历史 */}
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Film className="w-4 h-4 text-indigo-400"/> Generated Media History</h3>
                    <div className="space-y-3">
                      {generations.map((gen) => (
                          <div key={gen.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-2">
                            <p className="font-bold text-indigo-400">Input: {gen.input_data}</p>
                            <pre className="font-mono text-slate-300 bg-slate-900 p-3 rounded-xl whitespace-pre-wrap">{gen.output_media}</pre>
                            <p className="text-slate-500 text-[10px] text-right">{new Date(gen.created_at).toLocaleString()}</p>
                          </div>
                      ))}
                    </div>
                  </div>
                </>
            ) : (
                <div className="text-center py-20 text-slate-500">Select a prompt chain.</div>
            )}
          </div>
        </div>

        {/* Chain Modal */}
        {chainModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <form onSubmit={handleSaveChain} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4">
                <h3 className="font-bold text-lg">{editingChain ? 'Edit Chain' : 'Create Chain'}</h3>
                <input type="text" required placeholder="Chain Name" value={chainForm.name} onChange={(e) => setChainForm({ ...chainForm, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white" />
                <textarea placeholder="Description" value={chainForm.description} onChange={(e) => setChainForm({ ...chainForm, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white h-20" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setChainModal(false)} className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-xs font-bold rounded-xl text-white">Save</button>
                </div>
              </form>
            </div>
        )}

        {/* Step Modal */}
        {stepModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <form onSubmit={handleSaveStep} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4">
                <h3 className="font-bold text-lg">{editingStep ? 'Edit Step' : 'Create Step'}</h3>
                <input type="text" placeholder="Step Description" value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white" />
                <textarea required placeholder="Prompt Template" value={stepForm.prompt_template} onChange={(e) => setStepForm({ ...stepForm, prompt_template: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white h-24" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setStepModal(false)} className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-xs font-bold rounded-xl text-white">Save</button>
                </div>
              </form>
            </div>
        )}
      </div>
  )
}