/* Note Cine — Planos e limites de slots */
const NoteCinePlans = (() => {
    function getPlan(role) {
        const r = (role || 'user').toLowerCase();
        if (r === 'admin') {
            return { id: 'admin', label: 'Administrador', maxSlots: null, unlimited: true };
        }
        if (r === 'nitro') {
            return { id: 'nitro', label: 'Membro Plus', maxSlots: 7, unlimited: false };
        }
        if (r === 'cinefilo' || r === 'vip') {
            return { id: 'cinefilo', label: 'Cinéfilo', maxSlots: 10, unlimited: false };
        }
        return { id: 'user', label: 'Visitante', maxSlots: 5, unlimited: false };
    }

    function maxMovieSlots(role) {
        const plan = getPlan(role);
        if (plan.unlimited) return Infinity;
        return plan.maxSlots;
    }

    function roleBadgeText(role) {
        const plan = getPlan(role);
        if (plan.unlimited) {
            return `${plan.label} · filmes ilimitados`;
        }
        return `${plan.label} · até ${plan.maxSlots} filmes`;
    }

    function canAddMore(role, currentCount) {
        const plan = getPlan(role);
        if (plan.unlimited) return true;
        return currentCount < plan.maxSlots;
    }

    return { getPlan, maxMovieSlots, roleBadgeText, canAddMore };
})();
