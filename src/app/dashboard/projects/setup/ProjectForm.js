'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'
import { projectCopy } from '../../../../i18n/projects'
import { projectFormCopy } from '../../../../i18n/projectForm'
import styles from './project-setup.module.css'

const PROJECT_COVER_BUCKET = 'project-covers'
const MAX_COVER_SIZE = 20 * 1024 * 1024
const ALLOWED_COVER_TYPES = ['image/jpeg','image/png','image/webp','image/heic','image/heif']
const SIGNED_URL_DURATION = 60 * 60

function nullableValue(value) { const v = value.trim(); return v === '' ? null : v }
function initialData(project, suggestedCode) {
  return {
    code: project?.code || suggestedCode, name: project?.name || '', client_name: project?.client_name || '', status: project?.status || 'planning',
    proposal_number: project?.proposal_number || '', contract_number: project?.contract_number || '', contract_value: project?.contract_value ?? '', currency_code: project?.currency_code || 'USD',
    planned_start_date: project?.planned_start_date || '', planned_finish_date: project?.planned_finish_date || '', address_line: project?.address_line || '', neighborhood: project?.neighborhood || '', city: project?.city || '', state_region: project?.state_region || '', postal_code: project?.postal_code || '', country_code: project?.country_code || 'US',
    latitude: project?.latitude ?? '', longitude: project?.longitude ?? '', geofence_radius_m: project?.geofence_radius_m ?? '', max_gps_accuracy_m: project?.max_gps_accuracy_m ?? '', geofence_enabled: Boolean(project?.geofence_enabled),
  }
}
function extension(file) {
  const i = (file?.name || '').lastIndexOf('.')
  if (i >= 0 && i < file.name.length - 1) return file.name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif'})[file?.type] || 'jpg'
}

export default function ProjectForm({ organizationId, userId, project, suggestedCode, locale = 'en-US' }) {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const isEditing = Boolean(project?.id)
  const p = projectCopy(locale)
  const t = projectFormCopy(locale)
  const [formData, setFormData] = useState(() => initialData(project, suggestedCode))
  const [coverImagePath, setCoverImagePath] = useState(project?.cover_image_path || '')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [coverImageLoading, setCoverImageLoading] = useState(Boolean(project?.cover_image_path))
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isRemovingCover, setIsRemovingCover] = useState(false)
  const [coverErrorMessage, setCoverErrorMessage] = useState('')
  const [coverSuccessMessage, setCoverSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadCover() {
      if (!project?.id || !project?.cover_image_path) { setCoverImageLoading(false); return }
      const { data, error } = await createClient().storage.from(PROJECT_COVER_BUCKET).createSignedUrl(project.cover_image_path, SIGNED_URL_DURATION)
      if (cancelled) return
      if (error || !data?.signedUrl) { console.error('Project cover could not be loaded.', error); setCoverErrorMessage(t('coverLoadError')); setCoverImageLoading(false); return }
      setCoverImageUrl(data.signedUrl); setCoverImageLoading(false)
    }
    loadCover(); return () => { cancelled = true }
  }, [project?.id, project?.cover_image_path, locale])

  function handleChange(e) { const { name, value, type, checked } = e.target; setFormData(current => ({ ...current, [name]: type === 'checkbox' ? checked : value })) }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (!project?.id) { setCoverErrorMessage(t('createFirstCover')); e.target.value=''; return }
    if (!ALLOWED_COVER_TYPES.includes(file.type)) { setCoverErrorMessage(t('coverTypeInvalid')); e.target.value=''; return }
    if (file.size > MAX_COVER_SIZE) { setCoverErrorMessage(t('coverTooLarge')); e.target.value=''; return }
    setIsUploadingCover(true); setCoverErrorMessage(''); setCoverSuccessMessage('')
    const supabase = createClient(); const newPath = `${project.id}/cover-${Date.now()}.${extension(file)}`
    try {
      const { error: uploadError } = await supabase.storage.from(PROJECT_COVER_BUCKET).upload(newPath, file, { cacheControl:'3600', upsert:false, contentType:file.type })
      if (uploadError) throw uploadError
      const { error: updateError } = await supabase.from('projects').update({ cover_image_path:newPath }).eq('id', project.id)
      if (updateError) { await supabase.storage.from(PROJECT_COVER_BUCKET).remove([newPath]); throw updateError }
      const { data:signedData, error:signedError } = await supabase.storage.from(PROJECT_COVER_BUCKET).createSignedUrl(newPath, SIGNED_URL_DURATION)
      if (signedError) console.error('Project cover signed URL could not be created.', signedError)
      const previous = coverImagePath; setCoverImagePath(newPath); setCoverImageUrl(signedData?.signedUrl || '')
      if (previous && previous !== newPath) { const { error } = await supabase.storage.from(PROJECT_COVER_BUCKET).remove([previous]); if (error) console.warn('Previous project cover could not be removed.', error) }
      setCoverSuccessMessage(t('coverUploaded')); router.refresh()
    } catch (error) { setCoverErrorMessage(error?.message || t('unableUploadCover')) }
    finally { setIsUploadingCover(false); if (fileInputRef.current) fileInputRef.current.value='' }
  }

  async function handleRemoveCover() {
    if (!project?.id || !coverImagePath || isRemovingCover || !window.confirm(t('removeCoverConfirm'))) return
    setIsRemovingCover(true); setCoverErrorMessage(''); setCoverSuccessMessage(''); const supabase=createClient()
    try {
      const { error:updateError } = await supabase.from('projects').update({ cover_image_path:null }).eq('id', project.id); if (updateError) throw updateError
      const { error:removeError } = await supabase.storage.from(PROJECT_COVER_BUCKET).remove([coverImagePath]); if (removeError) console.warn('Project cover storage object could not be deleted.', removeError)
      setCoverImagePath(''); setCoverImageUrl(''); setCoverSuccessMessage(t('coverRemoved')); router.refresh()
    } catch (error) { setCoverErrorMessage(error?.message || t('unableRemoveCover')) }
    finally { setIsRemovingCover(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault(); setErrorMessage(''); setIsSaving(true)
    const contractValue = formData.contract_value === '' ? null : Number(formData.contract_value)
    if (contractValue !== null && (Number.isNaN(contractValue) || contractValue < 0)) { setErrorMessage(t('invalidContractValue')); setIsSaving(false); return }
    if (formData.planned_start_date && formData.planned_finish_date && formData.planned_finish_date < formData.planned_start_date) { setErrorMessage(t('invalidDates')); setIsSaving(false); return }
    const latitude=formData.latitude===''?null:Number(formData.latitude), longitude=formData.longitude===''?null:Number(formData.longitude), radius=formData.geofence_radius_m===''?null:Number(formData.geofence_radius_m), accuracy=formData.max_gps_accuracy_m===''?null:Number(formData.max_gps_accuracy_m)
    if (latitude!==null && (Number.isNaN(latitude)||latitude < -90||latitude > 90)) { setErrorMessage(t('invalidLatitude')); setIsSaving(false); return }
    if (longitude!==null && (Number.isNaN(longitude)||longitude < -180||longitude > 180)) { setErrorMessage(t('invalidLongitude')); setIsSaving(false); return }
    if (radius!==null && (Number.isNaN(radius)||!Number.isInteger(radius)||radius<=0)) { setErrorMessage(t('invalidGeofenceRadius')); setIsSaving(false); return }
    if (accuracy!==null && (Number.isNaN(accuracy)||!Number.isInteger(accuracy)||accuracy<=0)) { setErrorMessage(t('invalidGpsAccuracy')); setIsSaving(false); return }
    if (formData.geofence_enabled && (latitude===null||longitude===null||radius===null)) { setErrorMessage(t('geofenceRequired')); setIsSaving(false); return }
    const payload={ code:formData.code.trim().toUpperCase(), name:formData.name.trim(), client_name:nullableValue(formData.client_name), status:formData.status, proposal_number:nullableValue(formData.proposal_number), contract_number:nullableValue(formData.contract_number), contract_value:contractValue, currency_code:formData.currency_code.trim().toUpperCase(), planned_start_date:formData.planned_start_date||null, planned_finish_date:formData.planned_finish_date||null, address_line:nullableValue(formData.address_line), neighborhood:nullableValue(formData.neighborhood), city:nullableValue(formData.city), state_region:nullableValue(formData.state_region), postal_code:nullableValue(formData.postal_code), country_code:formData.country_code.trim().toUpperCase(), latitude, longitude, geofence_radius_m:radius, max_gps_accuracy_m:accuracy, geofence_enabled:formData.geofence_enabled }
    const supabase=createClient()
    try {
      if (isEditing) { const { error }=await supabase.from('projects').update(payload).eq('id',project.id); if(error) throw error }
      else {
        const { data:created,error }=await supabase.from('projects').insert({...payload,organization_id:organizationId,created_by:userId}).select('id').single(); if(error) throw error
        const { error:memberError }=await supabase.from('project_members').upsert({project_id:created.id,user_id:userId,role:'manager'},{onConflict:'project_id,user_id'}); if(memberError) console.error('Project membership could not be created.',memberError)
      }
      router.push('/dashboard/projects'); router.refresh()
    } catch(error) { setErrorMessage(error?.code==='23505'?t('duplicateCode'):(error?.message||t('unableSave'))); setIsSaving(false) }
  }

  const Field=({label,name,span='span4',type='text',required=false,placeholder,help,children,...rest}) => <div className={`${styles.field} ${styles[span]}`}><label className={styles.label} htmlFor={name}>{label}{required&&<span className={styles.required}> *</span>}</label>{children||<input className={styles.input} id={name} name={name} type={type} value={formData[name]} onChange={handleChange} placeholder={placeholder} required={required} {...rest}/>} {help&&<p className={styles.helpText}>{help}</p>}</div>
  const Heading=({title,help}) => <div className={styles.sectionHeading}><h3 className={styles.sectionTitle}>{title}</h3><p className={styles.sectionDescription}>{help}</p></div>

  return <article className={styles.formPanel}>
    <div className={styles.formHeader}><h2 className={styles.formTitle}>{isEditing?p.projectInformation:p.createProject}</h2><p className={styles.formDescription}>{t('formDescription')}</p></div>
    <form id="project-general-form" className={styles.form} onSubmit={handleSubmit}>
      <section className={styles.section}><Heading title={p.projectIdentity} help={t('identityHelp')}/><div className={styles.grid}>
        <Field label={p.projectCode} name="code" required placeholder="RF-0002" help={p.uniqueCode}/><Field label={p.projectName} name="name" span="span8" required placeholder={p.projectName}/><Field label={t('clientName')} name="client_name" span="span8" placeholder={t('clientPlaceholder')}/>
        <Field label={p.projectStatus} name="status"><select className={styles.select} id="status" name="status" value={formData.status} onChange={handleChange}><option value="planning">{t('planning')}</option><option value="active">{t('active')}</option><option value="on_hold">{t('onHold')}</option><option value="completed">{t('completed')}</option><option value="archived">{t('archived')}</option></select></Field>
      </div></section>

      <section className={styles.section}><Heading title={p.projectCover} help={t('coverHelp')}/><div className={styles.coverLayout}>
        <div className={styles.coverPreview}>{coverImageLoading?<div className={styles.coverPlaceholder}><span className={styles.coverPlaceholderIcon}>IM</span><span>{t('loadingCover')}</span></div>:coverImageUrl?<img src={coverImageUrl} alt={t('projectCoverAlt',{name:formData.name||p.project})} className={styles.coverImage}/>:<div className={styles.coverPlaceholder}><span className={styles.coverPlaceholderIcon}>IM</span><strong>{t('noCover')}</strong><span>{t('noCoverHelp')}</span></div>}</div>
        <div className={styles.coverDetails}><div><p className={styles.coverProjectName}>{formData.name||t('coverPhoto')}</p><p className={styles.coverHelp}>{t('coverRequirements')}</p></div>{!isEditing&&<div className={styles.coverNotice}>{t('createBeforeCover')}</div>}{coverErrorMessage&&<div className={styles.coverError}>{coverErrorMessage}</div>}{coverSuccessMessage&&<div className={styles.coverSuccess}>{coverSuccessMessage}</div>}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleCoverUpload} className={styles.hiddenFileInput}/><div className={styles.coverActions}><button type="button" className={styles.coverPrimaryButton} disabled={!isEditing||isUploadingCover||isRemovingCover} onClick={()=>fileInputRef.current?.click()}>{isUploadingCover?p.uploading:coverImagePath?p.changePhoto:p.uploadPhoto}</button>{coverImagePath&&<button type="button" className={styles.coverRemoveButton} disabled={isUploadingCover||isRemovingCover} onClick={handleRemoveCover}>{isRemovingCover?p.removing:p.removePhoto}</button>}</div>
        </div></div></section>

      <section className={styles.section}><Heading title={p.contractSchedule} help={t('contractHelp')}/><div className={styles.grid}><Field label={p.proposalNumber} name="proposal_number" span="span3"/><Field label={p.contractNumber} name="contract_number" span="span3"/><Field label={t('contractValue')} name="contract_value" span="span3" type="number" min="0" step="0.01"/><Field label={p.currency} name="currency_code" span="span3"><select className={styles.select} id="currency_code" name="currency_code" value={formData.currency_code} onChange={handleChange}>{['USD','BRL','CAD','EUR','GBP'].map(x=><option key={x} value={x}>{x}</option>)}</select></Field><Field label={p.plannedStartDate} name="planned_start_date" span="span6" type="date"/><Field label={p.plannedFinishDate} name="planned_finish_date" span="span6" type="date"/></div></section>

      <section className={styles.section}><Heading title={p.projectLocation} help={t('locationHelp')}/><div className={styles.grid}><Field label={p.address} name="address_line" span="span12" placeholder={t('addressPlaceholder')}/><Field label={p.neighborhood} name="neighborhood" span="span6"/><Field label={p.city} name="city" span="span6"/><Field label={p.stateRegion} name="state_region"/><Field label={p.postalCode} name="postal_code"/><Field label={p.countryCode} name="country_code" required placeholder="US" help={t('countryHelp')} maxLength="2"/></div></section>

      <section className={styles.section}><Heading title={p.attendanceGeofence} help={t('geofenceHelp')}/><div className={styles.grid}><Field label={p.referenceLatitude} name="latitude" type="number" min="-90" max="90" step="any" placeholder="-25.000000" help={t('latitudeHelp')}/><Field label={p.referenceLongitude} name="longitude" type="number" min="-180" max="180" step="any" placeholder="-50.000000" help={t('longitudeHelp')}/><Field label={p.geofenceRadius} name="geofence_radius_m" type="number" min="1" step="1" placeholder="150" help={t('geofenceRadiusHelp')}/><Field label={p.maxGpsAccuracy} name="max_gps_accuracy_m" type="number" min="1" step="1" placeholder="50" help={t('gpsAccuracyHelp')}/>
        <div className={`${styles.field} ${styles.span12}`}><label htmlFor="geofence_enabled" style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'14px 16px',border:'1px solid #d9e2ec',borderRadius:'12px',background:formData.geofence_enabled?'#f0fdfa':'#f8fafc',cursor:'pointer'}}><input id="geofence_enabled" name="geofence_enabled" type="checkbox" checked={formData.geofence_enabled} onChange={handleChange} style={{width:'18px',height:'18px',marginTop:'2px',accentColor:'#08aa96',cursor:'pointer'}}/><span><strong style={{display:'block',marginBottom:'4px',color:'#0f172a',fontSize:'0.86rem'}}>{p.enableGeofence}</strong><span style={{display:'block',color:'#64748b',fontSize:'0.78rem',lineHeight:1.5}}>{t('geofenceToggleHelp')}</span></span></label></div>
        <div className={`${styles.field} ${styles.span12}`}><div style={{padding:'12px 14px',border:formData.geofence_enabled?'1px solid #99f6e4':'1px solid #e2e8f0',borderRadius:'10px',background:formData.geofence_enabled?'#f0fdfa':'#f8fafc',color:formData.geofence_enabled?'#115e59':'#64748b',fontSize:'0.78rem',lineHeight:1.5}}>{formData.geofence_enabled?t('geofenceEnabled'):t('geofenceDisabled')}</div></div>
      </div></section>

      {errorMessage&&<p className={styles.errorMessage} role="alert">{errorMessage}</p>}
      {!isEditing&&<div className={styles.actions}><Link href="/dashboard/projects" className={styles.secondaryButton}>{t('cancel')}</Link><button className={styles.primaryButton} type="submit" disabled={isSaving}>{isSaving?p.creatingProject:p.createProject}</button></div>}
    </form>
  </article>
}
