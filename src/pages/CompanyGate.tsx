// src/pages/CompanyGate.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Building, ArrowRight, Lock, LogOut, Plus, Link2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { lockCompany, apiRequest, createTakeoverRequest } from '@/lib/api';

type GateMode = 'choose' | 'add' | 'join';

export default function CompanyGate() {
  const navigate = useNavigate();

  const {
    user,
    companies,
    setActiveCompany,
    logout,
    addCompany,
    pendingSignup,
    cancelSignup,
    completeSignupWithCompany,
    completeSignupWithJoin,
  } = useAuth();

  const [isReady, setIsReady] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [mode, setMode] = useState<GateMode>('choose');

  // Add company form fields
  const [companyName, setCompanyName] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPostalCode, setCompanyPostalCode] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyCountry, setCompanyCountry] = useState('Sweden');
  const [companyVatNumber, setCompanyVatNumber] = useState('');
  const [accountingStandard, setAccountingStandard] = useState<'' | 'K2' | 'K3'>('');

  // Join form
  const [joinOrgNumber, setJoinOrgNumber] = useState('');

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
  }, [companies]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // Om man INTE har pendingSignup och INTE är inloggad -> till login
    if (!pendingSignup && !user) {
      navigate('/login');
      return;
    }

    // Om man har pendingSignup får man vara kvar här även utan user
  }, [isReady, user, pendingSignup, navigate]);

  function handleOrgNumberChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '');
    const limited = digitsOnly.slice(0, 10);
    let formatted = limited;
    if (limited.length > 6) {
      formatted = limited.slice(0, 6) + '-' + limited.slice(6);
    }
    setOrgNumber(formatted);
  }

  function handleJoinOrgNumberChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '');
    const limited = digitsOnly.slice(0, 10);
    let formatted = limited;
    if (limited.length > 6) {
      formatted = limited.slice(0, 6) + '-' + limited.slice(6);
    }
    setJoinOrgNumber(formatted);
  }

  async function chooseCompany(companyId: string, companyNameForToast: string) {
		if (!user) return;

		setChoosingId(companyId);

		try {
			// försök låsa företaget
			const resRaw: any = await lockCompany(companyId, user.id);
			const res: any = resRaw && resRaw.data ? resRaw.data : resRaw;

			// success → gå in direkt
			if (res?.success === true) {
				setActiveCompany(companyId);
				toast.success("Valt bolag: " + companyNameForToast);
				navigate("/economy");
				return;
			}

			// låst av någon annan
			if (res?.locked === true) {
				const by = res.lockedBy || {};
				const who = by.name || by.email || "Någon annan";

				toast.info(who + " är inne i " + companyNameForToast + ". Skickar takeover request…");

				const takeoverRaw: any = await createTakeoverRequest(companyId, user.id);
				const takeover: any = takeoverRaw && takeoverRaw.data ? takeoverRaw.data : takeoverRaw;
				
				console.log("TAKEOVER RAW:", takeoverRaw);
				console.log("TAKEOVER DATA:", takeover);

				const expiresAtStr = takeover && takeover.expiresAt ? takeover.expiresAt : null;
				const expiresAt = expiresAtStr ? new Date(expiresAtStr).getTime() : (Date.now() + 30000);

				toast.info("Takeover request skickad – väntar på svar...");

				// poll tills takeover godkänns
				while (Date.now() < expiresAt) {
					await new Promise((r) => setTimeout(r, 1500));

					const retryRaw: any = await lockCompany(companyId, user.id);
					const retry: any = retryRaw && retryRaw.data ? retryRaw.data : retryRaw;

					if (retry?.success === true) {
						setActiveCompany(companyId);
						toast.success("Takeover godkänd – du är nu inne i " + companyNameForToast);
						navigate("/economy");
						return;
					}
				}

				toast.error("Takeover gick ut (30s). Försök igen.");
				return;
			}

			toast.error("Kunde inte öppna företag.");
		} catch (e) {
			toast.error("Fel när företag skulle öppnas.");
		} finally {
			setChoosingId(null);
		}
	}

  function handleLogout() {
    logout();

    if (pendingSignup) {
      cancelSignup();
    }

    navigate('/login');
  }

  function resetForms() {
    setCompanyName('');
    setOrgNumber('');
    setCompanyAddress('');
    setCompanyPostalCode('');
    setCompanyCity('');
    setCompanyCountry('Sweden');
    setCompanyVatNumber('');
    setAccountingStandard('');
    setJoinOrgNumber('');
  }

  function goChoose() {
    setMode('choose');
    resetForms();
  }

  function goAddCompany() {
    setMode('add');
    resetForms();
  }

  function goJoinCompany() {
    setMode('join');
    resetForms();
  }

  function validateCompanyForm(): string | null {
    if (!companyName.trim()) return 'Company name is required';

    const orgDigits = orgNumber.replace(/-/g, '');
    if (orgDigits.length !== 10 || !/^\d{10}$/.test(orgDigits)) {
      return 'Organization number must be exactly 10 digits';
    }

    if (!companyAddress.trim()) return 'Address is required';
    if (!companyPostalCode.trim()) return 'Postal code is required';
    if (!companyCity.trim()) return 'City is required';
    if (!companyCountry.trim()) return 'Country is required';
    if (!accountingStandard) return 'Choose K2 or K3';

    return null;
  }

  async function submitCreateCompany(e: React.FormEvent) {
    e.preventDefault();

    const err = validateCompanyForm();
    if (err) {
      toast.error(err);
      return;
    }

    const companyPayload = {
      companyName: companyName.trim(),
      organizationNumber: orgNumber,
      address: companyAddress.trim(),
      postalCode: companyPostalCode.trim(),
      city: companyCity.trim(),
      country: companyCountry.trim(),
      vatNumber: companyVatNumber.trim(),
      fiscalYearStart: '01-01',
      fiscalYearEnd: '12-31',
      accountingStandard: accountingStandard,
    };

    try {
      if (pendingSignup) {
        await completeSignupWithCompany(companyPayload as any);
        toast.success('Konto och bolag skapat!');
        goChoose();
        return;
      }

      if (!user) {
        toast.error('Du måste vara inloggad');
        return;
      }

      const created = addCompany(companyPayload as any);
      toast.success('Bolag skapat: ' + (created.companyName || ''));
      setMode('choose');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte skapa bolag';
      toast.error(message);
    }
  }

  async function createJoinRequest(userId: number, organizationNumber: string) {
    return apiRequest<any>('/companies/join-requests', {
      method: 'POST',
      json: { user_id: userId, organization_number: organizationNumber },
    });
  }

	async function submitJoinCompany(e: React.FormEvent) {
		e.preventDefault();

		const orgDigits = joinOrgNumber.replace(/-/g, '');
		if (orgDigits.length !== 10 || !/^\d{10}$/.test(orgDigits)) {
		toast.error('Organization number must be exactly 10 digits');
		return;
		}

		try {
		// Pending-signup: skapa user + skapa join request (inte direkt medlemskap)
		if (pendingSignup) {
			await completeSignupWithJoin(joinOrgNumber);
			toast.success('Join request skickad! Väntar på godkännande från ägaren/admin.');
			goChoose();
			return;
		}

		// Vanlig user måste finnas
		if (!user) {
			toast.error('Du måste vara inloggad');
			return;
		}

		const res = await createJoinRequest(Number(user.id), joinOrgNumber);

		if (!res || res.success !== true) {
			toast.error('Kunde inte skicka join request');
			return;
		}

		if (res.alreadyMember) {
			toast.success('Du är redan medlem i företaget.');
			setMode('choose');
			return;
		}

		if (res.alreadyRequested) {
			toast.info('Join request finns redan och väntar på godkännande.');
			setMode('choose');
			return;
		}

		toast.success('Join request skickad! Väntar på godkännande från ägaren/admin.');
		setMode('choose');
		} catch (error) {
		const message = error instanceof Error ? error.message : 'Kunde inte ansluta till företag';
		toast.error(message);
		}
	}

  function renderHeader() {
    return (
      <div className='text-center'>
        <Link to='/' className='inline-flex items-center gap-2 mb-8'>
          <div className='flex items-center justify-center w-10 h-10 rounded-lg bg-primary'>
            <span className='text-primary-foreground font-bold text-xl'>A</span>
          </div>
          <span className='text-2xl font-bold text-foreground'>
            Account<span className='text-secondary'>Pro</span>
          </span>
        </Link>

        <div className='inline-flex items-center justify-center w-12 h-12 rounded-lg bg-secondary/10 mb-4'>
          <Building className='h-6 w-6 text-secondary' />
        </div>

        <h1 className='text-2xl font-bold text-foreground mb-2'>
          {mode === 'choose' ? 'Välj bolag' : mode === 'add' ? 'Skapa nytt bolag' : 'Anslut till företag'}
        </h1>

        <p className='text-muted-foreground'>
          {mode === 'choose'
            ? 'Om någon annan redan jobbar i ett bolag kan du inte gå in där.'
            : mode === 'add'
              ? 'Fyll i uppgifterna för ditt nya bolag.'
              : 'Skriv organisationsnummer för att skicka en anslutningsförfrågan.'}
        </p>
      </div>
    );
  }

  function renderTopRightActions() {
    return (
      <div className='flex justify-between items-center'>
        <div className='text-sm font-medium text-foreground'>
          {pendingSignup ? 'Skapa konto: sista steget' : 'Dina bolag'}
        </div>

        <Button variant='ghost' onClick={handleLogout}>
          <LogOut className='mr-2 h-4 w-4' />
          {pendingSignup ? 'Avsluta' : 'Logga ut'}
        </Button>
      </div>
    );
  }

  function renderChoose() {
    return (
      <div className='space-y-3'>
        {renderTopRightActions()}

        {sortedCompanies.length === 0 ? (
          <div className='space-y-3'>
            <div className='rounded-lg border p-4'>
              <div className='font-medium text-foreground'>Inga bolag hittades</div>
              <div className='text-sm text-muted-foreground mt-1'>
                {pendingSignup
                  ? 'Du måste skapa eller ansluta till ett bolag för att slutföra kontot.'
                  : 'Lägg till ett bolag eller anslut till ett befintligt.'}
              </div>
            </div>

            <div className='flex gap-3'>
              <Button className='flex-1' onClick={goAddCompany}>
                <Plus className='mr-2 h-4 w-4' />
                Lägg till bolag
              </Button>
              <Button className='flex-1' variant='outline' onClick={goJoinCompany}>
                <Link2 className='mr-2 h-4 w-4' />
                Anslut
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className='space-y-2'>
              {sortedCompanies.map((c) => {
                const name = c.companyName || ('Bolag ' + c.id);
                return (
                  <Button
                    key={c.id}
                    type='button'
                    className='w-full justify-between'
                    variant='outline'
                    disabled={choosingId === c.id}
                    onClick={() => chooseCompany(c.id, name)}
                  >
                    <span className='truncate'>{name}</span>
                    <span className='flex items-center gap-2'>
                      {choosingId === c.id ? (
                        <>
                          <Lock className='h-4 w-4' />
                          Låser...
                        </>
                      ) : (
                        <>
                          Välj
                          <ArrowRight className='h-4 w-4' />
                        </>
                      )}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className='flex gap-3'>
              <Button className='flex-1' onClick={goAddCompany}>
                <Plus className='mr-2 h-4 w-4' />
                Lägg till bolag
              </Button>
              <Button className='flex-1' variant='outline' onClick={goJoinCompany}>
                <Link2 className='mr-2 h-4 w-4' />
                Anslut
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderAdd() {
    return (
      <div className='space-y-6'>
        {renderTopRightActions()}

        <form onSubmit={submitCreateCompany} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='companyName'>Company Name *</Label>
            <Input
              id='companyName'
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder='Your Company AB'
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='orgNumber'>Organization Number *</Label>
            <Input
              id='orgNumber'
              value={orgNumber}
              onChange={(e) => handleOrgNumberChange(e.target.value)}
              placeholder='XXXXXX-XXXX'
              maxLength={11}
              required
            />
            <p className='text-xs text-muted-foreground'>{orgNumber.replace(/-/g, '').length}/10 digits</p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='companyAddress'>Address *</Label>
            <Input
              id='companyAddress'
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder='Storgatan 1'
              required
            />
          </div>

          <div className='grid grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='companyPostalCode'>Postal Code *</Label>
              <Input
                id='companyPostalCode'
                value={companyPostalCode}
                onChange={(e) => setCompanyPostalCode(e.target.value)}
                placeholder='123 45'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='companyCity'>City *</Label>
              <Input
                id='companyCity'
                value={companyCity}
                onChange={(e) => setCompanyCity(e.target.value)}
                placeholder='Stockholm'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='companyCountry'>Country *</Label>
              <Input
                id='companyCountry'
                value={companyCountry}
                onChange={(e) => setCompanyCountry(e.target.value)}
                placeholder='Sweden'
                required
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='companyVatNumber'>VAT Number</Label>
            <Input
              id='companyVatNumber'
              value={companyVatNumber}
              onChange={(e) => setCompanyVatNumber(e.target.value)}
              placeholder='SE123456789001'
            />
          </div>

          <div className='space-y-2'>
            <Label>Accounting Standard *</Label>
            <Select value={accountingStandard} onValueChange={(v) => setAccountingStandard(v as 'K2' | 'K3')}>
              <SelectTrigger>
                <SelectValue placeholder='Välj K2 eller K3...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='K2'>K2</SelectItem>
                <SelectItem value='K3'>K3</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>K2 är för mindre bolag, K3 är för större bolag</p>
          </div>

          <div className='flex gap-3'>
            <Button type='button' className='flex-1' variant='outline' onClick={goChoose}>
              Tillbaka
            </Button>
            <Button type='submit' className='flex-1'>
              Skapa bolag
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  function renderJoin() {
    return (
      <div className='space-y-6'>
        {renderTopRightActions()}

        <form onSubmit={submitJoinCompany} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='joinOrgnr'>Organization Number *</Label>
            <Input
              id='joinOrgnr'
              value={joinOrgNumber}
              onChange={(e) => handleJoinOrgNumberChange(e.target.value)}
              placeholder='XXXXXX-XXXX'
              maxLength={11}
              required
            />
            <p className='text-xs text-muted-foreground'>{joinOrgNumber.replace(/-/g, '').length}/10 digits</p>
          </div>

          <div className='flex gap-3'>
            <Button type='button' className='flex-1' variant='outline' onClick={goChoose}>
              Tillbaka
            </Button>
            <Button type='submit' className='flex-1'>
              Skicka förfrågan
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          </div>

          <div className='rounded-lg border p-4'>
            <div className='font-medium text-foreground'>Obs</div>
            <div className='text-sm text-muted-foreground mt-1'>
              Detta skickar en join request. Du blir medlem först när ägaren/administratören godkänner.
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex'>
      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='w-full max-w-md space-y-8'>
          {renderHeader()}
          {mode === 'choose' ? renderChoose() : mode === 'add' ? renderAdd() : renderJoin()}
        </div>
      </div>

      <div className='hidden lg:flex flex-1 bg-gradient-hero items-center justify-center p-12'>
        <div className='max-w-md text-primary-foreground'>
          <h2 className='text-3xl font-bold mb-6'>Säker redigering</h2>
          <ul className='space-y-4'>
            <li className='flex items-start gap-3'>
              <div className='w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5'>
                <span className='text-secondary text-sm'>✓</span>
              </div>
              <span>Välj bolag innan du går vidare</span>
            </li>
            <li className='flex items-start gap-3'>
              <div className='w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5'>
                <span className='text-secondary text-sm'>✓</span>
              </div>
              <span>Du får tydlig popup om någon annan redan är inne</span>
            </li>
            <li className='flex items-start gap-3'>
              <div className='w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5'>
                <span className='text-secondary text-sm'>✓</span>
              </div>
              <span>Skapa nytt bolag eller skicka anslutningsförfrågan</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}