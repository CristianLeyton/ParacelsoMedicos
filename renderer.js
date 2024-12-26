const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const addMandatariaButton = document.getElementById('addMandataria');
  const addEntidadButton = document.getElementById('addEntidad');
  const addMedicoButton = document.getElementById('addMedico');
  const medicoNombreInput = document.getElementById('medicoNombre');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const closeModal = document.getElementById('closeModal');

  const showModal = (message) => {
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  
    // Cerrar modal al hacer clic fuera de él
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModalFunction();
      }
    });
  
    // Cerrar modal con Enter o Escape
    document.addEventListener('keydown', handleKeyPress);
  };
  
  const closeModalFunction = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    medicoNombreInput.focus();
  
    // Remover eventos para evitar duplicados
    document.removeEventListener('keydown', handleKeyPress);
  };
  
  const handleKeyPress = (event) => {
    if (event.key === 'Escape') {
      closeModalFunction();
    }
  };
  
  closeModal.addEventListener('click', closeModalFunction);

  // Verificar existencia al cargar
  ipcRenderer.invoke('check-mandataria').then((mandatariaExists) => {
    addMandatariaButton.disabled = mandatariaExists;
    if (mandatariaExists) {
      ipcRenderer.invoke('check-entidad').then((entidadExists) => {
        addEntidadButton.disabled = entidadExists;
        addMedicoButton.disabled = !entidadExists;
      }).catch((error) => {
        console.error('Error al verificar entidad:', error);
      });
    }
  }).catch((error) => {
    console.error('Error al verificar mandataria:', error);
  });

  addMandatariaButton.addEventListener('click', () => {
    ipcRenderer.invoke('add-mandataria').then((exists) => {
      if (!exists) {
        showModal('La mandataria "PARACELSO" se creó con éxito.');
        addMandatariaButton.disabled = true;
        addEntidadButton.disabled = false;
      } else {
        showModal('La mandataria "PARACELSO" ya existe.');
      }
    });
  });

  addEntidadButton.addEventListener('click', () => {
    ipcRenderer.invoke('add-entidad').then((success) => {
      if (success) {
        showModal('Entidad "MEDICOS PARACELSO" agregada con éxito.');
        addEntidadButton.disabled = true;
        addMedicoButton.disabled = false;
      } else {
        showModal('No se pudo agregar la entidad.');
      }
    });
  });

  const addMedico = () => {
    const medicoNombre = medicoNombreInput.value.trim();
    if (medicoNombre) {
      ipcRenderer.invoke('add-medico', medicoNombre).then((success) => {
        if (success) {
          showModal(`Médico "${medicoNombre}" agregado con éxito.`);
          medicoNombreInput.value = '';
        } else {
          showModal('No se pudo agregar el médico. Verifique que no exista otro médico con el mismo nombre.');
        }
      }).catch((error) => {
        console.error('Error al agregar médico:', error);
      });
    } else {
      showModal('Por favor, ingrese un nombre para el médico.');
    }
  };

  addMedicoButton.addEventListener('click', addMedico);

  // Permitir agregar médico con Enter
  medicoNombreInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      addMedico();
    }
  });
});
